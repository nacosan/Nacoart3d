-- Fase 2: perfiles, categorías y suscripciones personales.
--
-- Tablas: profiles, categories, subscriptions, subscription_prices y
-- ledger_entries (solo pagos personales en esta fase).
--
-- Autorización (docs/propuesta-mvp.md §3.2):
--   * RLS activado en todas las tablas.
--   * anon no tiene ningún privilegio.
--   * authenticated lee sus filas. Escribe directamente solo su perfil
--     (columnas concretas) y los datos básicos de sus suscripciones.
--   * Precios y pagos se escriben solo mediante funciones SECURITY DEFINER
--     con search_path vacío, que comprueban auth.uid().
--   * Los pagos nunca se editan ni se borran: se anulan con un movimiento nuevo.

-- 0. Seguridad: no se toca nada si alguna tabla ya existe.
do $$
begin
  if to_regclass('public.profiles') is not null
     or to_regclass('public.categories') is not null
     or to_regclass('public.subscriptions') is not null
     or to_regclass('public.subscription_prices') is not null
     or to_regclass('public.ledger_entries') is not null then
    raise exception 'Alguna tabla de la fase 2 ya existe. Revisa el esquema antes de continuar.';
  end if;
end
$$;

-- 1. Utilidad: updated_at automático.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Perfiles.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_hue text not null default 'azul'
    check (avatar_hue in ('azul', 'verde', 'ambar', 'rosa', 'oliva', 'turquesa', 'lila')),
  currency char(3) not null default 'EUR' check (currency in ('EUR', 'USD', 'GBP')),
  timezone text not null default 'Europe/Madrid' check (char_length(timezone) between 1 and 64),
  monthly_budget_cents bigint check (monthly_budget_cents is null or monthly_budget_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Perfil creado al registrarse. El nombre sale de los metadatos del registro
-- (no es un rol ni da permisos) o, si no hay, de la parte local del email.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Usuario'
      ),
      60
    )
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Categorías (catálogo fijo).
create table public.categories (
  id text primary key,
  name text not null,
  hue text not null,
  sort_order smallint not null
);

insert into public.categories (id, name, hue, sort_order) values
  ('video', 'Vídeo', 'rosa', 1),
  ('musica', 'Música', 'azul', 2),
  ('software', 'Software', 'lila', 3),
  ('almacenamiento', 'Almacenamiento', 'turquesa', 4),
  ('juegos', 'Juegos', 'oliva', 5),
  ('noticias', 'Noticias', 'ambar', 6),
  ('otros', 'Otros', 'verde', 7);

-- 4. Suscripciones (solo modo personal en esta fase; la fase 3 añade 'shared').
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'personal' check (mode = 'personal'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category_id text not null references public.categories (id),
  currency char(3) not null default 'EUR' check (currency in ('EUR', 'USD', 'GBP')),
  billing_period text not null check (billing_period in ('monthly', 'yearly')),
  renewal_anchor date not null,
  status text not null default 'active' check (status in ('active', 'trial', 'paused', 'cancelled')),
  cancelled_on date,
  paid_through_date date,
  manage_url text check (manage_url is null or (manage_url ~* '^https?://' and char_length(manage_url) <= 500)),
  notes text check (notes is null or char_length(notes) <= 1000),
  -- Desde cuándo se avisa de renovaciones sin pago registrado (no se reclama el pasado anterior al alta).
  tracking_from date not null default current_date,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_cancel_fields check (
    (status = 'cancelled' and cancelled_on is not null)
    or (status <> 'cancelled' and cancelled_on is null and paid_through_date is null)
  ),
  constraint subscriptions_idempotency unique (owner_id, idempotency_key)
);

create index subscriptions_owner_status_idx on public.subscriptions (owner_id, status);
create index subscriptions_category_idx on public.subscriptions (category_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- 5. Historial de precios: cada precio aplica desde su fecha, nunca hacia atrás.
create table public.subscription_prices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  effective_from date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint subscription_prices_unique_from unique (subscription_id, effective_from)
);

create index subscription_prices_created_by_idx on public.subscription_prices (created_by);

-- 6. Movimientos (dinero real). En la fase 2, solo pagos personales y anulaciones.
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  kind text not null check (kind in ('personal_payment', 'void')),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null check (currency in ('EUR', 'USD', 'GBP')),
  occurred_on date not null,
  -- Fecha del calendario de renovaciones que paga (opcional).
  renewal_date date,
  concept text check (concept is null or char_length(concept) <= 200),
  voids_entry_id uuid references public.ledger_entries (id),
  created_by uuid references auth.users (id) on delete set null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint ledger_entries_void_shape check (
    (kind = 'void' and voids_entry_id is not null and renewal_date is null)
    or (kind <> 'void' and voids_entry_id is null)
  ),
  constraint ledger_entries_idempotency unique (subscription_id, idempotency_key)
);

create index ledger_entries_subscription_date_idx on public.ledger_entries (subscription_id, occurred_on);
create unique index ledger_entries_one_void_idx on public.ledger_entries (voids_entry_id) where voids_entry_id is not null;
create index ledger_entries_created_by_idx on public.ledger_entries (created_by);

-- 7. RLS y privilegios.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_prices enable row level security;
alter table public.ledger_entries enable row level security;

revoke all on table public.profiles, public.categories, public.subscriptions,
  public.subscription_prices, public.ledger_entries from anon, authenticated;

grant select on table public.profiles, public.categories, public.subscriptions,
  public.subscription_prices, public.ledger_entries to authenticated;

-- Solo columnas editables del perfil: no hay forma de cambiar el id.
grant update (display_name, avatar_hue, currency, timezone, monthly_budget_cents)
  on table public.profiles to authenticated;

-- Datos básicos de una suscripción personal. Periodicidad, ancla y moneda no se
-- editan: cambiarían el calendario y los importes del pasado.
grant update (name, category_id, status, cancelled_on, paid_through_date, manage_url, notes)
  on table public.subscriptions to authenticated;
grant delete on table public.subscriptions to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy categories_select_all on public.categories
  for select to authenticated using (true);

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy subscriptions_update_own on public.subscriptions
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy subscriptions_delete_own on public.subscriptions
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy subscription_prices_select_own on public.subscription_prices
  for select to authenticated using (
    exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and s.owner_id = (select auth.uid())
    )
  );

create policy ledger_entries_select_own on public.ledger_entries
  for select to authenticated using (
    exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and s.owner_id = (select auth.uid())
    )
  );

-- 8. Funciones de escritura. Errores con mensajes clave que la app traduce.

create function public.create_personal_subscription(
  p_name text,
  p_category_id text,
  p_currency text,
  p_billing_period text,
  p_renewal_anchor date,
  p_status text,
  p_amount_cents bigint,
  p_manage_url text,
  p_notes text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
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

  insert into public.subscriptions (
    owner_id, name, category_id, currency, billing_period, renewal_anchor,
    status, manage_url, notes, idempotency_key
  )
  values (
    v_uid, btrim(p_name), p_category_id, p_currency, p_billing_period, p_renewal_anchor,
    p_status, nullif(btrim(p_manage_url), ''), nullif(btrim(p_notes), ''), p_idempotency_key
  )
  returning id into v_id;

  insert into public.subscription_prices (subscription_id, amount_cents, effective_from, created_by)
  values (v_id, p_amount_cents, p_renewal_anchor, v_uid);

  return v_id;
end;
$$;

create function public.set_subscription_price(
  p_subscription_id uuid,
  p_amount_cents bigint,
  p_effective_from date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_latest date;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invalid_amount';
  end if;

  perform 1 from public.subscriptions
  where id = p_subscription_id and owner_id = v_uid
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  select max(effective_from) into v_latest
  from public.subscription_prices
  where subscription_id = p_subscription_id;

  -- El pasado no se reescribe: un precio nuevo empieza después del último.
  if v_latest is not null and p_effective_from <= v_latest then
    raise exception 'price_not_forward';
  end if;

  insert into public.subscription_prices (subscription_id, amount_cents, effective_from, created_by)
  values (p_subscription_id, p_amount_cents, p_effective_from, v_uid);
end;
$$;

create function public.register_personal_payment(
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
  where id = p_subscription_id and owner_id = v_uid and mode = 'personal'
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

create function public.void_personal_payment(
  p_entry_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_entry public.ledger_entries%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select e.* into v_entry
  from public.ledger_entries e
  join public.subscriptions s on s.id = e.subscription_id
  where e.id = p_entry_id and s.owner_id = v_uid and e.kind = 'personal_payment'
  for update of e;
  if v_entry.id is null then
    raise exception 'not_found';
  end if;

  select id into v_id from public.ledger_entries where voids_entry_id = p_entry_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.ledger_entries (
    subscription_id, kind, amount_cents, currency, occurred_on, concept,
    voids_entry_id, created_by, idempotency_key
  )
  values (
    v_entry.subscription_id, 'void', v_entry.amount_cents, v_entry.currency, current_date,
    'Anulación', p_entry_id, v_uid, p_idempotency_key
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_personal_subscription(text, text, text, text, date, text, bigint, text, text, uuid) from public, anon;
revoke all on function public.set_subscription_price(uuid, bigint, date) from public, anon;
revoke all on function public.register_personal_payment(uuid, bigint, date, date, text, uuid) from public, anon;
revoke all on function public.void_personal_payment(uuid, uuid) from public, anon;

grant execute on function public.create_personal_subscription(text, text, text, text, date, text, bigint, text, text, uuid) to authenticated;
grant execute on function public.set_subscription_price(uuid, bigint, date) to authenticated;
grant execute on function public.register_personal_payment(uuid, bigint, date, date, text, uuid) to authenticated;
grant execute on function public.void_personal_payment(uuid, uuid) to authenticated;
