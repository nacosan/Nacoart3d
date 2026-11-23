-- Fase 3b: cobros entre los miembros de un grupo.
--
-- Cada renovación del plan genera, para cada miembro (no el líder), una parte
-- a pagar: el precio de esa fecha repartido entre quienes estaban en el grupo
-- ese día. Esa parte se calcula en la app a partir de subscription_members
-- (joined_on / left_on) y del historial de precios, así que entrar o salir del
-- grupo no cambia lo que se debía antes.
--
-- Aquí solo se guarda el dinero que se mueve:
--   * el líder anota un cobro          -> 'confirmed' directamente;
--   * el miembro declara "he pagado"   -> 'declared', y el líder lo confirma o lo rechaza;
--   * un cobro confirmado no se borra:  se marca 'voided' (anulado), con quién y cuándo.
--
-- Privacidad: un miembro solo ve sus propios pagos; el líder ve los de todos.

do $$
begin
  if to_regclass('public.member_payments') is not null then
    raise exception 'public.member_payments ya existe. Revisa el esquema antes de continuar.';
  end if;
  if to_regclass('public.subscription_members') is null then
    raise exception 'Falta la migración de la fase 3a.';
  end if;
end
$$;

create table public.member_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  member_id uuid not null references public.subscription_members (id) on delete cascade,
  -- Renovación (fecha del calendario del plan) que paga.
  renewal_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null check (currency in ('EUR', 'USD', 'GBP')),
  paid_on date not null,
  status text not null check (status in ('declared', 'confirmed', 'rejected', 'voided')),
  note text check (note is null or char_length(note) <= 200),
  declared_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint member_payments_idempotency unique (subscription_id, idempotency_key)
);

create index member_payments_subscription_idx on public.member_payments (subscription_id, renewal_date);
create index member_payments_member_idx on public.member_payments (member_id);
create index member_payments_declared_by_idx on public.member_payments (declared_by);
create index member_payments_reviewed_by_idx on public.member_payments (reviewed_by);

-- ¿La participación es de quien llama?
create function public.is_own_membership(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscription_members
    where id = p_member_id and user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_own_membership(uuid) from public, anon;
grant execute on function public.is_own_membership(uuid) to authenticated;

alter table public.member_payments enable row level security;
revoke all on table public.member_payments from anon, authenticated;
grant select on table public.member_payments to authenticated;

create policy member_payments_select on public.member_payments
  for select to authenticated
  using (public.is_subscription_owner(subscription_id) or public.is_own_membership(member_id));

-- Anota un pago de un miembro. Si lo anota el líder, queda confirmado; si lo
-- declara el propio miembro, queda pendiente de que el líder lo confirme.
create function public.record_member_payment(
  p_member_id uuid,
  p_renewal_date date,
  p_amount_cents bigint,
  p_paid_on date,
  p_note text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.subscription_members%rowtype;
  v_sub public.subscriptions%rowtype;
  v_status text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_renewal_date is null or p_paid_on is null then
    raise exception 'invalid_date';
  end if;

  select * into v_member from public.subscription_members where id = p_member_id;
  if v_member.id is null or v_member.role <> 'member' then
    raise exception 'not_found';
  end if;

  select * into v_sub from public.subscriptions
  where id = v_member.subscription_id and mode = 'shared'
  for update;
  if v_sub.id is null then
    raise exception 'not_found';
  end if;

  if v_sub.owner_id = v_uid then
    v_status := 'confirmed';
  elsif v_member.user_id = v_uid and v_member.status = 'active' then
    v_status := 'declared';
  else
    raise exception 'not_found';
  end if;

  -- Se cuenta desde la renovación del periodo en que entró (como mucho, un año antes).
  if p_renewal_date < v_member.joined_on - 366 then
    raise exception 'invalid_date';
  end if;

  select id into v_id from public.member_payments
  where subscription_id = v_sub.id and idempotency_key = p_idempotency_key;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.member_payments (
    subscription_id, member_id, renewal_date, amount_cents, currency, paid_on, status, note,
    declared_by, reviewed_by, reviewed_at, idempotency_key
  )
  values (
    v_sub.id, p_member_id, p_renewal_date, p_amount_cents, v_sub.currency, p_paid_on, v_status,
    nullif(btrim(p_note), ''), v_uid,
    case when v_status = 'confirmed' then v_uid end,
    case when v_status = 'confirmed' then now() end,
    p_idempotency_key
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- El líder confirma o rechaza un pago declarado por un miembro.
create function public.review_member_payment(p_payment_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.member_payments mp
  set status = case when p_accept then 'confirmed' else 'rejected' end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  from public.subscriptions s
  where mp.id = p_payment_id and s.id = mp.subscription_id
    and s.owner_id = auth.uid() and mp.status = 'declared';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- El líder anula un cobro confirmado (queda en el historial como anulado).
create function public.void_member_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.member_payments mp
  set status = 'voided', reviewed_by = auth.uid(), reviewed_at = now()
  from public.subscriptions s
  where mp.id = p_payment_id and s.id = mp.subscription_id
    and s.owner_id = auth.uid() and mp.status = 'confirmed';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.record_member_payment(uuid, date, bigint, date, text, uuid) from public, anon;
revoke all on function public.review_member_payment(uuid, boolean) from public, anon;
revoke all on function public.void_member_payment(uuid) from public, anon;
grant execute on function public.record_member_payment(uuid, date, bigint, date, text, uuid) to authenticated;
grant execute on function public.review_member_payment(uuid, boolean) to authenticated;
grant execute on function public.void_member_payment(uuid) to authenticated;
