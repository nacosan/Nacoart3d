-- Fase 3a: catálogo de servicios y planes, suscripciones compartidas (grupos),
-- miembros (con cuenta o invitados sin cuenta) e invitaciones por email.
--
-- Decisiones (2026-11-23):
--   * Una persona con cuenta solo entra en un grupo aceptando una invitación.
--   * Esta fase cubre miembros y reparto igualitario; los cobros entre miembros
--     llegan en la fase 4.
--   * Precios del catálogo leídos de las páginas oficiales de España el
--     2026-11-22. Los que no se pudieron verificar quedan vacíos (null): la app
--     los muestra como desconocidos y pide el importe.
--
-- Autorización: RLS en todas las tablas; miembros e invitaciones solo se
-- escriben mediante funciones SECURITY DEFINER que comprueban auth.uid().

-- 0. Seguridad: no se toca nada si alguna tabla nueva ya existe.
do $$
begin
  if to_regclass('public.services') is not null
     or to_regclass('public.plans') is not null
     or to_regclass('public.subscription_members') is not null
     or to_regclass('public.invitations') is not null then
    raise exception 'Alguna tabla de la fase 3a ya existe. Revisa el esquema antes de continuar.';
  end if;
  if to_regclass('public.subscriptions') is null then
    raise exception 'Falta la migración de la fase 2.';
  end if;
end
$$;

-- 1. Catálogo.
create table public.services (
  id text primary key,
  name text not null,
  category_id text not null references public.categories (id),
  website text,
  sort_order smallint not null default 100
);

create index services_category_idx on public.services (category_id);

create table public.plans (
  id text primary key,
  service_id text not null references public.services (id),
  name text not null,
  billing_period text not null check (billing_period in ('monthly', 'yearly')),
  -- null: precio no verificado.
  price_cents bigint check (price_cents is null or price_cents >= 0),
  currency char(3) not null default 'EUR' check (currency in ('EUR', 'USD', 'GBP')),
  -- Personas que pueden usar el plan, titular incluido. null: desconocido.
  max_members smallint check (max_members is null or max_members >= 1),
  -- Plan pensado para compartir (familiar, dúo): se ofrece compartir marcado por defecto.
  is_family boolean not null default false,
  conditions text,
  source_url text,
  verified_on date,
  sort_order smallint not null default 100,
  constraint plans_price_verified check ((price_cents is null) = (verified_on is null))
);

create index plans_service_idx on public.plans (service_id);

-- 2. Suscripciones: modo compartido, plan del catálogo y plazas.
alter table public.subscriptions drop constraint subscriptions_mode_check;
alter table public.subscriptions add constraint subscriptions_mode_check check (mode in ('personal', 'shared'));
alter table public.subscriptions add column plan_id text references public.plans (id) on delete set null;
alter table public.subscriptions add column max_members smallint
  check (max_members is null or max_members between 2 and 20);
alter table public.subscriptions add constraint subscriptions_shared_capacity
  check (mode = 'personal' or max_members is not null);

create index subscriptions_plan_idx on public.subscriptions (plan_id);

-- 3. Miembros.
create table public.subscription_members (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  guest_name text check (guest_name is null or char_length(btrim(guest_name)) between 1 and 60),
  role text not null check (role in ('leader', 'member')),
  status text not null default 'active' check (status in ('active', 'left')),
  joined_on date not null default current_date,
  left_on date,
  created_at timestamptz not null default now(),
  constraint subscription_members_identity check (user_id is not null or guest_name is not null),
  constraint subscription_members_left check ((status = 'left') = (left_on is not null))
);

create index subscription_members_subscription_idx on public.subscription_members (subscription_id);
create index subscription_members_user_active_idx on public.subscription_members (user_id) where status = 'active';
create unique index subscription_members_one_active_user
  on public.subscription_members (subscription_id, user_id)
  where status = 'active' and user_id is not null;
create unique index subscription_members_one_leader
  on public.subscription_members (subscription_id)
  where status = 'active' and role = 'leader';

-- 4. Invitaciones por email (la persona las acepta o rechaza dentro de la app).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  invited_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  responded_at timestamptz
);

create index invitations_subscription_idx on public.invitations (subscription_id);
create index invitations_email_pending_idx on public.invitations (email) where status = 'pending';
create index invitations_invited_by_idx on public.invitations (invited_by);
create unique index invitations_one_pending
  on public.invitations (subscription_id, email)
  where status = 'pending';

-- 5. Funciones auxiliares para las políticas (evitan recursión de RLS).
create function public.is_subscription_owner(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions
    where id = p_subscription_id and owner_id = (select auth.uid())
  );
$$;

create function public.is_group_member(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscription_members
    where subscription_id = p_subscription_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

-- Email verificado de quien llama (no se fía de lo que envía el cliente).
create function public.current_verified_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(email) from auth.users
  where id = (select auth.uid()) and email_confirmed_at is not null;
$$;

revoke all on function public.is_subscription_owner(uuid) from public, anon;
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.current_verified_email() from public, anon;
-- Se usa en la política de invitations; solo devuelve el email de quien llama.
grant execute on function public.current_verified_email() to authenticated;
grant execute on function public.is_subscription_owner(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;

-- 6. RLS y privilegios.
alter table public.services enable row level security;
alter table public.plans enable row level security;
alter table public.subscription_members enable row level security;
alter table public.invitations enable row level security;

revoke all on table public.services, public.plans, public.subscription_members, public.invitations
  from anon, authenticated;
grant select on table public.services, public.plans, public.subscription_members, public.invitations
  to authenticated;

create policy services_select_all on public.services for select to authenticated using (true);
create policy plans_select_all on public.plans for select to authenticated using (true);

-- Los miembros activos ven la suscripción (datos del plan y precio total).
drop policy subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own_or_member on public.subscriptions
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_group_member(id));

drop policy subscription_prices_select_own on public.subscription_prices;
create policy subscription_prices_select_own_or_member on public.subscription_prices
  for select to authenticated
  using (public.is_subscription_owner(subscription_id) or public.is_group_member(subscription_id));

-- Los pagos (ledger_entries) siguen siendo solo del propietario.

create policy subscription_members_select on public.subscription_members
  for select to authenticated
  using (public.is_subscription_owner(subscription_id) or public.is_group_member(subscription_id));

create policy invitations_select on public.invitations
  for select to authenticated
  using (public.is_subscription_owner(subscription_id) or email = public.current_verified_email());

-- 7. Funciones de escritura.

-- Plazas ocupadas (miembros activos) más reservadas (invitaciones pendientes sin caducar).
create function public.group_seats_used(p_subscription_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.subscription_members
    where subscription_id = p_subscription_id and status = 'active'
  )::integer + (
    select count(*) from public.invitations
    where subscription_id = p_subscription_id and status = 'pending' and expires_at > now()
  )::integer;
$$;

revoke all on function public.group_seats_used(uuid) from public, anon, authenticated;

create function public.normalize_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(p_email)) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(btrim(p_email)) <= 254
      then lower(btrim(p_email))
    else null
  end;
$$;

-- Crea una suscripción (personal o compartida) con su primer precio y, si es
-- compartida, el líder, los invitados sin cuenta y las invitaciones por email.
create function public.create_subscription(
  p_name text,
  p_category_id text,
  p_currency text,
  p_billing_period text,
  p_renewal_anchor date,
  p_status text,
  p_amount_cents bigint,
  p_manage_url text,
  p_notes text,
  p_idempotency_key uuid,
  p_plan_id text,
  p_shared boolean,
  p_max_members smallint,
  p_guests text[],
  p_invite_emails text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_plan public.plans%rowtype;
  v_max smallint;
  v_guest text;
  v_email text;
  v_own_email text;
  v_guests text[] := '{}';
  v_emails text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_status not in ('active', 'trial', 'paused') then
    raise exception 'invalid_status';
  end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invalid_amount';
  end if;

  select id into v_id
  from public.subscriptions
  where owner_id = v_uid and idempotency_key = p_idempotency_key;
  if v_id is not null then
    return v_id;
  end if;

  if p_plan_id is not null then
    select * into v_plan from public.plans where id = p_plan_id;
    if v_plan.id is null then
      raise exception 'invalid_plan';
    end if;
  end if;

  if coalesce(p_shared, false) then
    -- Un máximo verificado del plan manda sobre el manual.
    v_max := coalesce(case when v_plan.max_members >= 2 then v_plan.max_members end, p_max_members);
    if v_max is null or v_max < 2 or v_max > 20 then
      raise exception 'invalid_capacity';
    end if;

    select lower(email) into v_own_email from auth.users where id = v_uid;

    foreach v_guest in array coalesce(p_guests, '{}') loop
      v_guest := btrim(v_guest);
      if v_guest = '' then
        continue;
      end if;
      if char_length(v_guest) > 60 then
        raise exception 'invalid_guest';
      end if;
      v_guests := v_guests || v_guest;
    end loop;

    foreach v_email in array coalesce(p_invite_emails, '{}') loop
      if btrim(v_email) = '' then
        continue;
      end if;
      v_email := public.normalize_email(v_email);
      if v_email is null then
        raise exception 'invalid_email';
      end if;
      if v_email = v_own_email then
        raise exception 'invite_self';
      end if;
      if not v_email = any (v_emails) then
        v_emails := v_emails || v_email;
      end if;
    end loop;

    if 1 + cardinality(v_guests) + cardinality(v_emails) > v_max then
      raise exception 'group_full';
    end if;
  end if;

  insert into public.subscriptions (
    owner_id, mode, name, category_id, currency, billing_period, renewal_anchor,
    status, manage_url, notes, idempotency_key, plan_id, max_members
  )
  values (
    v_uid,
    case when coalesce(p_shared, false) then 'shared' else 'personal' end,
    btrim(p_name), p_category_id, p_currency, p_billing_period, p_renewal_anchor,
    p_status, nullif(btrim(p_manage_url), ''), nullif(btrim(p_notes), ''), p_idempotency_key,
    p_plan_id, case when coalesce(p_shared, false) then v_max end
  )
  returning id into v_id;

  insert into public.subscription_prices (subscription_id, amount_cents, effective_from, created_by)
  values (v_id, p_amount_cents, p_renewal_anchor, v_uid);

  if coalesce(p_shared, false) then
    insert into public.subscription_members (subscription_id, user_id, role)
    values (v_id, v_uid, 'leader');

    foreach v_guest in array v_guests loop
      insert into public.subscription_members (subscription_id, guest_name, role)
      values (v_id, v_guest, 'member');
    end loop;

    foreach v_email in array v_emails loop
      insert into public.invitations (subscription_id, email, invited_by)
      values (v_id, v_email, v_uid);
    end loop;
  end if;

  return v_id;
end;
$$;

-- Convierte una suscripción personal en compartida (el propietario pasa a líder).
create function public.share_subscription(p_subscription_id uuid, p_max_members smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.subscriptions%rowtype;
  v_plan_max smallint;
  v_max smallint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_sub from public.subscriptions
  where id = p_subscription_id and owner_id = v_uid
  for update;
  if v_sub.id is null then
    raise exception 'not_found';
  end if;
  if v_sub.mode = 'shared' then
    return;
  end if;

  select max_members into v_plan_max from public.plans where id = v_sub.plan_id;
  v_max := coalesce(case when v_plan_max >= 2 then v_plan_max end, p_max_members);
  if v_max is null or v_max < 2 or v_max > 20 then
    raise exception 'invalid_capacity';
  end if;

  update public.subscriptions set mode = 'shared', max_members = v_max where id = p_subscription_id;
  insert into public.subscription_members (subscription_id, user_id, role)
  values (p_subscription_id, v_uid, 'leader');
end;
$$;

create function public.add_group_guest(p_subscription_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max smallint;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid_guest';
  end if;

  select max_members into v_max from public.subscriptions
  where id = p_subscription_id and owner_id = v_uid and mode = 'shared'
  for update;
  if v_max is null then
    raise exception 'not_found';
  end if;
  if public.group_seats_used(p_subscription_id) >= v_max then
    raise exception 'group_full';
  end if;

  insert into public.subscription_members (subscription_id, guest_name, role)
  values (p_subscription_id, btrim(p_name), 'member')
  returning id into v_id;
  return v_id;
end;
$$;

create function public.invite_group_member(p_subscription_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max smallint;
  v_email text := public.normalize_email(p_email);
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_email is null then
    raise exception 'invalid_email';
  end if;

  select max_members into v_max from public.subscriptions
  where id = p_subscription_id and owner_id = v_uid and mode = 'shared'
  for update;
  if v_max is null then
    raise exception 'not_found';
  end if;
  if v_email = (select lower(email) from auth.users where id = v_uid) then
    raise exception 'invite_self';
  end if;
  if exists (
    select 1 from public.invitations
    where subscription_id = p_subscription_id and email = v_email and status = 'pending' and expires_at > now()
  ) then
    raise exception 'already_invited';
  end if;
  if exists (
    select 1 from public.subscription_members m
    join auth.users u on u.id = m.user_id
    where m.subscription_id = p_subscription_id and m.status = 'active' and lower(u.email) = v_email
  ) then
    raise exception 'already_member';
  end if;

  -- Una invitación pendiente caducada deja de reservar plaza: se marca como revocada.
  update public.invitations set status = 'revoked', responded_at = now()
  where subscription_id = p_subscription_id and email = v_email and status = 'pending';

  if public.group_seats_used(p_subscription_id) >= v_max then
    raise exception 'group_full';
  end if;

  insert into public.invitations (subscription_id, email, invited_by)
  values (p_subscription_id, v_email, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.invitations i set status = 'revoked', responded_at = now()
  from public.subscriptions s
  where i.id = p_invitation_id and s.id = i.subscription_id
    and s.owner_id = auth.uid() and i.status = 'pending';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.remove_group_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  -- El líder no se puede quitar a sí mismo (primero habría que transferir el liderazgo).
  update public.subscription_members m set status = 'left', left_on = current_date
  from public.subscriptions s
  where m.id = p_member_id and s.id = m.subscription_id
    and s.owner_id = auth.uid() and m.status = 'active' and m.role = 'member';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.current_verified_email();
  v_inv public.invitations%rowtype;
  v_max smallint;
  v_active integer;
begin
  if v_uid is null or v_email is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_inv from public.invitations
  where id = p_invitation_id and email = v_email
  for update;
  if v_inv.id is null then
    raise exception 'not_found';
  end if;
  if v_inv.status <> 'pending' or v_inv.expires_at <= now() then
    raise exception 'invitation_unavailable';
  end if;

  -- Bloquea el grupo para que dos aceptaciones simultáneas no superen el máximo.
  select max_members into v_max from public.subscriptions
  where id = v_inv.subscription_id and mode = 'shared'
  for update;
  if v_max is null then
    raise exception 'invitation_unavailable';
  end if;

  if exists (
    select 1 from public.subscription_members
    where subscription_id = v_inv.subscription_id and user_id = v_uid and status = 'active'
  ) then
    update public.invitations set status = 'accepted', responded_at = now() where id = v_inv.id;
    return v_inv.subscription_id;
  end if;

  -- Esta invitación ya reservaba plaza: basta con que los activos no lleguen al máximo.
  select count(*) into v_active from public.subscription_members
  where subscription_id = v_inv.subscription_id and status = 'active';
  if v_active >= v_max then
    raise exception 'group_full';
  end if;

  insert into public.subscription_members (subscription_id, user_id, role)
  values (v_inv.subscription_id, v_uid, 'member');
  update public.invitations set status = 'accepted', responded_at = now() where id = v_inv.id;
  return v_inv.subscription_id;
end;
$$;

create function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.invitations set status = 'declined', responded_at = now()
  where id = p_invitation_id and email = public.current_verified_email() and status = 'pending';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.leave_group(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.subscription_members set status = 'left', left_on = current_date
  where subscription_id = p_subscription_id and user_id = auth.uid()
    and status = 'active' and role = 'member';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- Invitaciones pendientes de quien llama, con lo justo para decidir.
create function public.my_pending_invitations()
returns table (
  id uuid,
  subscription_name text,
  leader_name text,
  price_cents bigint,
  currency char(3),
  billing_period text,
  active_members integer,
  max_members smallint,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    s.name,
    coalesce(p.display_name, 'Alguien'),
    (select sp.amount_cents from public.subscription_prices sp
      where sp.subscription_id = s.id and sp.effective_from <= current_date
      order by sp.effective_from desc limit 1),
    s.currency,
    s.billing_period,
    (select count(*)::integer from public.subscription_members m
      where m.subscription_id = s.id and m.status = 'active'),
    s.max_members,
    i.expires_at
  from public.invitations i
  join public.subscriptions s on s.id = i.subscription_id
  left join public.profiles p on p.id = s.owner_id
  where i.email = public.current_verified_email()
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at;
$$;

-- Miembros de un grupo con su nombre visible. Solo para el líder y los miembros.
create function public.get_group_members(p_subscription_id uuid)
returns table (
  member_id uuid,
  display_name text,
  avatar_hue text,
  is_guest boolean,
  role text,
  is_me boolean,
  joined_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    coalesce(m.guest_name, p.display_name, 'Participante'),
    coalesce(p.avatar_hue, 'verde'),
    m.user_id is null,
    m.role,
    coalesce(m.user_id = (select auth.uid()), false),
    m.joined_on
  from public.subscription_members m
  left join public.profiles p on p.id = m.user_id
  where m.subscription_id = p_subscription_id
    and m.status = 'active'
    and (public.is_subscription_owner(p_subscription_id) or public.is_group_member(p_subscription_id))
  order by m.role, m.created_at;
$$;

-- Los pagos al proveedor también se anotan en suscripciones compartidas (los anota el líder).
create or replace function public.register_personal_payment(
  p_subscription_id uuid,
  p_amount_cents bigint,
  p_occurred_on date,
  p_renewal_date date,
  p_concept text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_currency char(3);
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  select currency into v_currency
  from public.subscriptions
  where id = p_subscription_id and owner_id = v_uid
  for update;
  if v_currency is null then
    raise exception 'not_found';
  end if;

  select id into v_id
  from public.ledger_entries
  where subscription_id = p_subscription_id and idempotency_key = p_idempotency_key;
  if v_id is not null then
    return v_id;
  end if;

  if p_renewal_date is not null and exists (
    select 1
    from public.ledger_entries e
    where e.subscription_id = p_subscription_id
      and e.kind = 'personal_payment'
      and e.renewal_date = p_renewal_date
      and not exists (select 1 from public.ledger_entries v where v.voids_entry_id = e.id)
  ) then
    raise exception 'renewal_already_paid';
  end if;

  insert into public.ledger_entries (
    subscription_id, kind, amount_cents, currency, occurred_on, renewal_date,
    concept, created_by, idempotency_key
  )
  values (
    p_subscription_id, 'personal_payment', p_amount_cents, v_currency, p_occurred_on, p_renewal_date,
    nullif(btrim(p_concept), ''), v_uid, p_idempotency_key
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- La función de la fase 2 queda sustituida por create_subscription.
drop function public.create_personal_subscription(text, text, text, text, date, text, bigint, text, text, uuid);

revoke all on function public.normalize_email(text) from public, anon, authenticated;
revoke all on function public.create_subscription(text, text, text, text, date, text, bigint, text, text, uuid, text, boolean, smallint, text[], text[]) from public, anon;
revoke all on function public.share_subscription(uuid, smallint) from public, anon;
revoke all on function public.add_group_guest(uuid, text) from public, anon;
revoke all on function public.invite_group_member(uuid, text) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
revoke all on function public.remove_group_member(uuid) from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
revoke all on function public.decline_invitation(uuid) from public, anon;
revoke all on function public.leave_group(uuid) from public, anon;
revoke all on function public.my_pending_invitations() from public, anon;
revoke all on function public.get_group_members(uuid) from public, anon;

grant execute on function public.create_subscription(text, text, text, text, date, text, bigint, text, text, uuid, text, boolean, smallint, text[], text[]) to authenticated;
grant execute on function public.share_subscription(uuid, smallint) to authenticated;
grant execute on function public.add_group_guest(uuid, text) to authenticated;
grant execute on function public.invite_group_member(uuid, text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.my_pending_invitations() to authenticated;
grant execute on function public.get_group_members(uuid) to authenticated;

-- 8. Catálogo inicial (España). Precios leídos de las páginas oficiales el 2026-11-22.
--    price_cents null = no se pudo verificar: la app pide el importe.
insert into public.services (id, name, category_id, website, sort_order) values
  ('spotify', 'Spotify', 'musica', 'https://www.spotify.com/es/account/', 10),
  ('apple-music', 'Apple Music', 'musica', 'https://www.apple.com/es/apple-music/', 20),
  ('youtube-premium', 'YouTube Premium', 'video', 'https://www.youtube.com/paid_memberships', 30),
  ('youtube-music', 'YouTube Music', 'musica', 'https://www.youtube.com/paid_memberships', 40),
  ('amazon-music', 'Amazon Music Unlimited', 'musica', 'https://www.amazon.es/music/unlimited', 50),
  ('tidal', 'Tidal', 'musica', 'https://tidal.com', 60),
  ('netflix', 'Netflix', 'video', 'https://www.netflix.com/youraccount', 10),
  ('amazon-prime', 'Amazon Prime', 'video', 'https://www.amazon.es/prime', 20),
  ('disney-plus', 'Disney+', 'video', 'https://www.disneyplus.com/es-es/account', 30),
  ('hbo-max', 'HBO Max', 'video', 'https://www.hbomax.com/es/es', 40),
  ('apple-tv', 'Apple TV', 'video', 'https://www.apple.com/es/apple-tv-plus/', 50),
  ('movistar-plus', 'Movistar Plus+', 'video', 'https://www.movistarplus.es', 60),
  ('dazn', 'DAZN', 'video', 'https://www.dazn.com/es-ES/myaccount', 70),
  ('filmin', 'Filmin', 'video', 'https://www.filmin.es', 80),
  ('ps-plus', 'PlayStation Plus', 'juegos', 'https://www.playstation.com/es-es/ps-plus/', 10),
  ('xbox-game-pass', 'Xbox Game Pass', 'juegos', 'https://www.xbox.com/es-ES/xbox-game-pass', 20),
  ('nintendo-switch-online', 'Nintendo Switch Online', 'juegos', 'https://www.nintendo.com/es-es/', 30),
  ('ea-play', 'EA Play', 'juegos', 'https://www.ea.com/es-es/ea-play', 40),
  ('claude', 'Claude', 'software', 'https://claude.ai/settings/billing', 10),
  ('chatgpt', 'ChatGPT', 'software', 'https://chatgpt.com/pricing', 20),
  ('microsoft-365', 'Microsoft 365', 'software', 'https://account.microsoft.com/services', 30),
  ('google-one', 'Google One', 'almacenamiento', 'https://one.google.com', 10),
  ('icloud', 'iCloud+', 'almacenamiento', 'https://www.apple.com/es/icloud/', 20),
  ('apple-one', 'Apple One', 'software', 'https://www.apple.com/es/apple-one/', 40);

insert into public.plans
  (id, service_id, name, billing_period, price_cents, currency, max_members, is_family, conditions, source_url, verified_on, sort_order)
values
  -- Spotify
  ('spotify-individual', 'spotify', 'Premium Individual', 'monthly', 1199, 'EUR', 1, false, null, 'https://www.spotify.com/es/premium/', '2026-11-22', 10),
  ('spotify-duo', 'spotify', 'Premium Duo', 'monthly', 1699, 'EUR', 2, true, 'Para parejas que convivan en el mismo domicilio.', 'https://www.spotify.com/es/premium/', '2026-11-22', 20),
  ('spotify-familiar', 'spotify', 'Premium Familiar', 'monthly', 2099, 'EUR', 6, true, 'Para hasta 6 miembros de una familia que convivan.', 'https://www.spotify.com/es/premium/', '2026-11-22', 30),
  ('spotify-estudiantes', 'spotify', 'Premium para Estudiantes', 'monthly', 649, 'EUR', 1, false, 'Requiere verificación de estudiante universitario.', 'https://www.spotify.com/es/premium/', '2026-11-22', 40),
  -- Apple Music
  ('apple-music-individual', 'apple-music', 'Individual', 'monthly', 1199, 'EUR', 1, false, null, 'https://www.apple.com/es/apple-music/', '2026-11-22', 10),
  ('apple-music-familiar', 'apple-music', 'Familiar', 'monthly', 1999, 'EUR', 6, true, 'Se comparte con En Familia de Apple.', 'https://www.apple.com/es/apple-music/', '2026-11-22', 20),
  ('apple-music-estudiante', 'apple-music', 'Estudiante', 'monthly', 699, 'EUR', 1, false, 'Requiere verificación de estudiante universitario, hasta cuatro años.', 'https://www.apple.com/es/apple-music/', '2026-11-22', 30),
  -- YouTube (no verificado)
  ('youtube-premium-individual', 'youtube-premium', 'Individual', 'monthly', null, 'EUR', 1, false, null, null, null, 10),
  ('youtube-premium-familiar', 'youtube-premium', 'Familiar', 'monthly', null, 'EUR', null, true, 'Para miembros del mismo hogar.', null, null, 20),
  ('youtube-music-individual', 'youtube-music', 'Individual', 'monthly', null, 'EUR', 1, false, null, null, null, 10),
  ('youtube-music-familiar', 'youtube-music', 'Familiar', 'monthly', null, 'EUR', null, true, 'Para miembros del mismo hogar.', null, null, 20),
  -- Amazon Music Unlimited (no verificado)
  ('amazon-music-individual', 'amazon-music', 'Individual', 'monthly', null, 'EUR', 1, false, null, null, null, 10),
  ('amazon-music-familiar', 'amazon-music', 'Familiar', 'monthly', null, 'EUR', null, true, null, null, null, 20),
  -- Tidal (no verificado)
  ('tidal-individual', 'tidal', 'Individual', 'monthly', null, 'EUR', 1, false, null, null, null, 10),
  ('tidal-familiar', 'tidal', 'Familiar', 'monthly', null, 'EUR', null, true, null, null, null, 20),
  -- Netflix (precio en EUR no verificado)
  ('netflix-anuncios', 'netflix', 'Estándar con anuncios', 'monthly', null, 'EUR', null, false, 'Solo se comparte dentro del mismo hogar.', null, null, 10),
  ('netflix-estandar', 'netflix', 'Estándar', 'monthly', null, 'EUR', null, false, 'Solo se comparte dentro del mismo hogar. Admite 1 miembro extra con coste adicional.', null, null, 20),
  ('netflix-premium', 'netflix', 'Premium', 'monthly', null, 'EUR', null, false, 'Solo se comparte dentro del mismo hogar. Admite hasta 2 miembros extra con coste adicional.', null, null, 30),
  -- Amazon Prime (no verificado)
  ('amazon-prime-mensual', 'amazon-prime', 'Prime mensual', 'monthly', null, 'EUR', null, false, null, null, null, 10),
  ('amazon-prime-anual', 'amazon-prime', 'Prime anual', 'yearly', null, 'EUR', null, false, null, null, null, 20),
  -- Disney+
  ('disney-anuncios', 'disney-plus', 'Estándar con anuncios', 'monthly', 699, 'EUR', null, false, '2 reproducciones simultáneas.', 'https://www.disneyplus.com/es-es', '2026-11-22', 10),
  ('disney-estandar', 'disney-plus', 'Estándar', 'monthly', 1099, 'EUR', null, false, '2 reproducciones simultáneas.', 'https://www.disneyplus.com/es-es', '2026-11-22', 20),
  ('disney-premium', 'disney-plus', 'Prémium', 'monthly', 1599, 'EUR', null, false, '4 reproducciones simultáneas, 4K UHD y HDR.', 'https://www.disneyplus.com/es-es', '2026-11-22', 30),
  ('disney-estandar-anual', 'disney-plus', 'Estándar anual', 'yearly', 10990, 'EUR', null, false, '2 reproducciones simultáneas.', 'https://www.disneyplus.com/es-es', '2026-11-22', 40),
  ('disney-premium-anual', 'disney-plus', 'Prémium anual', 'yearly', 15990, 'EUR', null, false, '4 reproducciones simultáneas, 4K UHD y HDR.', 'https://www.disneyplus.com/es-es', '2026-11-22', 50),
  -- HBO Max
  ('hbo-basico', 'hbo-max', 'Básico con anuncios', 'monthly', 699, 'EUR', null, false, '2 dispositivos a la vez.', 'https://www.hbomax.com/es/es', '2026-11-22', 10),
  ('hbo-estandar', 'hbo-max', 'Estándar', 'monthly', 1099, 'EUR', null, false, '2 dispositivos a la vez.', 'https://www.hbomax.com/es/es', '2026-11-22', 20),
  ('hbo-premium', 'hbo-max', 'Premium', 'monthly', 1599, 'EUR', null, false, '4 dispositivos a la vez, 4K UHD.', 'https://www.hbomax.com/es/es', '2026-11-22', 30),
  ('hbo-basico-anual', 'hbo-max', 'Básico con anuncios anual', 'yearly', 6990, 'EUR', null, false, '2 dispositivos a la vez.', 'https://www.hbomax.com/es/es', '2026-11-22', 40),
  ('hbo-estandar-anual', 'hbo-max', 'Estándar anual', 'yearly', 10900, 'EUR', null, false, '2 dispositivos a la vez.', 'https://www.hbomax.com/es/es', '2026-11-22', 50),
  ('hbo-premium-anual', 'hbo-max', 'Premium anual', 'yearly', 15900, 'EUR', null, false, '4 dispositivos a la vez, 4K UHD.', 'https://www.hbomax.com/es/es', '2026-11-22', 60),
  -- Apple TV
  ('apple-tv', 'apple-tv', 'Apple TV', 'monthly', 999, 'EUR', 6, false, 'Se puede compartir con En Familia de Apple.', 'https://www.apple.com/es/apple-tv-plus/', '2026-11-22', 10),
  -- Movistar Plus+
  ('movistar-cine-series', 'movistar-plus', 'Plan Libre: Cine y Series', 'monthly', 499, 'EUR', null, false, 'Sin permanencia. 2 reproducciones simultáneas.', 'https://www.movistarplus.es', '2026-11-22', 10),
  ('movistar-completo', 'movistar-plus', 'Plan Libre: Cine, Series y Deportes', 'monthly', 999, 'EUR', null, false, 'Sin permanencia. 2 reproducciones simultáneas.', 'https://www.movistarplus.es', '2026-11-22', 20),
  ('movistar-completo-anual', 'movistar-plus', 'Plan Libre anual: Cine, Series y Deportes', 'yearly', 9990, 'EUR', null, false, '12 meses por el precio de 10.', 'https://www.movistarplus.es', '2026-11-22', 30),
  -- DAZN y Filmin (no verificado)
  ('dazn', 'dazn', 'Suscripción', 'monthly', null, 'EUR', null, false, null, null, null, 10),
  ('filmin-mensual', 'filmin', 'Mensual', 'monthly', null, 'EUR', null, false, null, null, null, 10),
  ('filmin-anual', 'filmin', 'Anual', 'yearly', null, 'EUR', null, false, null, null, null, 20),
  -- PlayStation Plus (no verificado: la web pide iniciar sesión)
  ('ps-plus-essential', 'ps-plus', 'Essential 12 meses', 'yearly', null, 'EUR', null, false, null, null, null, 10),
  ('ps-plus-extra', 'ps-plus', 'Extra 12 meses', 'yearly', null, 'EUR', null, false, null, null, null, 20),
  ('ps-plus-premium', 'ps-plus', 'Premium 12 meses', 'yearly', null, 'EUR', null, false, null, null, null, 30),
  ('ps-plus-essential-mensual', 'ps-plus', 'Essential mensual', 'monthly', null, 'EUR', null, false, null, null, null, 40),
  ('ps-plus-extra-mensual', 'ps-plus', 'Extra mensual', 'monthly', null, 'EUR', null, false, null, null, null, 50),
  ('ps-plus-premium-mensual', 'ps-plus', 'Premium mensual', 'monthly', null, 'EUR', null, false, null, null, null, 60),
  -- Xbox Game Pass (no verificado en EUR)
  ('xbox-essential', 'xbox-game-pass', 'Essential', 'monthly', null, 'EUR', null, false, null, null, null, 10),
  ('xbox-premium', 'xbox-game-pass', 'Premium', 'monthly', null, 'EUR', null, false, null, null, null, 20),
  ('xbox-ultimate', 'xbox-game-pass', 'Ultimate', 'monthly', null, 'EUR', null, false, 'Incluye EA Play y Ubisoft+ Classics.', null, null, 30),
  ('xbox-pc', 'xbox-game-pass', 'PC Game Pass', 'monthly', null, 'EUR', null, false, 'Solo PC. Incluye EA Play.', null, null, 40),
  -- Nintendo Switch Online (no verificado)
  ('nso-individual', 'nintendo-switch-online', 'Individual 12 meses', 'yearly', null, 'EUR', 1, false, null, null, null, 10),
  ('nso-familiar', 'nintendo-switch-online', 'Familiar 12 meses', 'yearly', null, 'EUR', null, true, null, null, null, 20),
  ('nso-individual-expansion', 'nintendo-switch-online', 'Individual + Paquete de expansión', 'yearly', null, 'EUR', 1, false, null, null, null, 30),
  ('nso-familiar-expansion', 'nintendo-switch-online', 'Familiar + Paquete de expansión', 'yearly', null, 'EUR', null, true, null, null, null, 40),
  -- EA Play
  ('ea-play-mensual', 'ea-play', 'EA Play mensual', 'monthly', 599, 'EUR', 1, false, 'Válido en 1 plataforma.', 'https://www.ea.com/es-es/ea-play', '2026-11-22', 10),
  ('ea-play-anual', 'ea-play', 'EA Play anual', 'yearly', 3999, 'EUR', 1, false, 'Válido en 1 plataforma.', 'https://www.ea.com/es-es/ea-play', '2026-11-22', 20),
  ('ea-play-pro-mensual', 'ea-play', 'EA Play Pro mensual', 'monthly', 1699, 'EUR', 1, false, 'Válido en 1 plataforma.', 'https://www.ea.com/es-es/ea-play', '2026-11-22', 30),
  ('ea-play-pro-anual', 'ea-play', 'EA Play Pro anual', 'yearly', 11999, 'EUR', 1, false, 'Válido en 1 plataforma.', 'https://www.ea.com/es-es/ea-play', '2026-11-22', 40),
  -- Claude (precios en USD sin impuestos, según la página oficial)
  ('claude-pro', 'claude', 'Pro mensual', 'monthly', 2000, 'USD', 1, false, 'Precio en dólares sin impuestos.', 'https://claude.com/pricing', '2026-11-22', 10),
  ('claude-pro-anual', 'claude', 'Pro anual', 'yearly', 20000, 'USD', 1, false, 'Precio en dólares sin impuestos.', 'https://claude.com/pricing', '2026-11-22', 20),
  ('claude-max', 'claude', 'Max', 'monthly', 10000, 'USD', 1, false, 'Precio en dólares sin impuestos.', 'https://claude.com/pricing', '2026-11-22', 30),
  ('claude-ultra', 'claude', 'Ultra', 'monthly', 20000, 'USD', 1, false, 'Precio en dólares sin impuestos.', 'https://claude.com/pricing', '2026-11-22', 40),
  -- ChatGPT (no verificado)
  ('chatgpt-go', 'chatgpt', 'Go', 'monthly', null, 'EUR', 1, false, null, null, null, 10),
  ('chatgpt-plus', 'chatgpt', 'Plus', 'monthly', null, 'EUR', 1, false, null, null, null, 20),
  ('chatgpt-pro', 'chatgpt', 'Pro', 'monthly', null, 'EUR', 1, false, null, null, null, 30),
  -- Microsoft 365
  ('m365-personal', 'microsoft-365', 'Personal mensual', 'monthly', 1000, 'EUR', 1, false, null, 'https://www.microsoft.com/es-es/microsoft-365/buy/compare-all-microsoft-365-products', '2026-11-22', 10),
  ('m365-personal-anual', 'microsoft-365', 'Personal anual', 'yearly', 9900, 'EUR', 1, false, null, 'https://www.microsoft.com/es-es/microsoft-365/buy/compare-all-microsoft-365-products', '2026-11-22', 20),
  ('m365-familia', 'microsoft-365', 'Familia mensual', 'monthly', 1300, 'EUR', 6, true, 'Hasta 6 personas. 2 TB compartidos.', 'https://www.microsoft.com/es-es/microsoft-365/buy/compare-all-microsoft-365-products', '2026-11-22', 30),
  ('m365-familia-anual', 'microsoft-365', 'Familia anual', 'yearly', 12900, 'EUR', 6, true, 'Hasta 6 personas. 2 TB compartidos.', 'https://www.microsoft.com/es-es/microsoft-365/buy/compare-all-microsoft-365-products', '2026-11-22', 40),
  ('m365-premium', 'microsoft-365', 'Premium mensual', 'monthly', 2200, 'EUR', 1, false, null, 'https://www.microsoft.com/es-es/microsoft-365/buy/compare-all-microsoft-365-products', '2026-11-22', 50),
  ('m365-premium-anual', 'microsoft-365', 'Premium anual', 'yearly', 21900, 'EUR', 1, false, null, 'https://www.microsoft.com/es-es/microsoft-365/buy/compare-all-microsoft-365-products', '2026-11-22', 60),
  -- Google One (precio en EUR no verificado; se comparte con hasta 5 personas más)
  ('google-one-basic', 'google-one', 'Basic 100 GB', 'monthly', null, 'EUR', 6, false, 'Se puede compartir con hasta 5 personas más.', null, null, 10),
  ('google-one-ai-plus', 'google-one', 'Google AI Plus', 'monthly', null, 'EUR', 6, false, 'Se puede compartir con hasta 5 personas más.', null, null, 20),
  ('google-one-ai-pro', 'google-one', 'Google AI Pro', 'monthly', null, 'EUR', 6, false, 'Se puede compartir con hasta 5 personas más.', null, null, 30),
  -- iCloud+
  ('icloud-50', 'icloud', '50 GB', 'monthly', 99, 'EUR', 6, false, 'Se puede compartir con hasta 5 familiares (En Familia).', 'https://www.apple.com/es/icloud/', '2026-11-22', 10),
  ('icloud-200', 'icloud', '200 GB', 'monthly', 299, 'EUR', 6, false, 'Se puede compartir con hasta 5 familiares (En Familia).', 'https://www.apple.com/es/icloud/', '2026-11-22', 20),
  ('icloud-2tb', 'icloud', '2 TB', 'monthly', 999, 'EUR', 6, false, 'Se puede compartir con hasta 5 familiares (En Familia).', 'https://www.apple.com/es/icloud/', '2026-11-22', 30),
  ('icloud-6tb', 'icloud', '6 TB', 'monthly', 2999, 'EUR', 6, false, 'Se puede compartir con hasta 5 familiares (En Familia).', 'https://www.apple.com/es/icloud/', '2026-11-22', 40),
  ('icloud-12tb', 'icloud', '12 TB', 'monthly', 5999, 'EUR', 6, false, 'Se puede compartir con hasta 5 familiares (En Familia).', 'https://www.apple.com/es/icloud/', '2026-11-22', 50),
  -- Apple One
  ('apple-one-individual', 'apple-one', 'Individual', 'monthly', 1995, 'EUR', 1, false, 'iCloud+ 50 GB, Apple TV, Apple Music y Apple Arcade.', 'https://www.apple.com/es/apple-one/', '2026-11-22', 10),
  ('apple-one-familiar', 'apple-one', 'Familiar', 'monthly', 2795, 'EUR', 6, true, 'iCloud+ 200 GB, Apple TV, Apple Music y Apple Arcade. Hasta 6 personas.', 'https://www.apple.com/es/apple-one/', '2026-11-22', 20),
  ('apple-one-premium', 'apple-one', 'Premium', 'monthly', 3695, 'EUR', 6, true, 'iCloud+ 2 TB, Apple TV, Apple Music, Apple Arcade y Apple Fitness+. Hasta 6 personas.', 'https://www.apple.com/es/apple-one/', '2026-11-22', 30);
