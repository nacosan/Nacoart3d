-- Fase 3d: un pago puede cubrir varias renovaciones (por ejemplo, un año entero).
--
-- periods = número de renovaciones seguidas que cubre el pago, empezando en
-- renewal_date. En un plan mensual, 12 = todo el año; en uno anual, 1.
-- El calendario de pagos de la app lo dibuja como un único tramo.
-- Los pagos que ya existen cubren 1 renovación (valor por defecto).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'member_payments' and column_name = 'periods'
  ) then
    raise exception 'La fase 3d ya está aplicada.';
  end if;
end
$$;

alter table public.member_payments
  add column periods smallint not null default 1 check (periods between 1 and 24);
alter table public.ledger_entries
  add column periods smallint not null default 1 check (periods between 1 and 24);

-- Las dos funciones de anotar pagos ganan p_periods: se sustituyen.
drop function public.record_member_payment(uuid, date, bigint, date, text, uuid);
drop function public.register_personal_payment(uuid, bigint, date, date, text, uuid);

create function public.record_member_payment(
  p_member_id uuid,
  p_renewal_date date,
  p_amount_cents bigint,
  p_paid_on date,
  p_note text,
  p_idempotency_key uuid,
  p_periods smallint
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
  if p_periods is null or p_periods not between 1 and 24 then
    raise exception 'invalid_periods';
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
    declared_by, reviewed_by, reviewed_at, idempotency_key, periods
  )
  values (
    v_sub.id, p_member_id, p_renewal_date, p_amount_cents, v_sub.currency, p_paid_on, v_status,
    nullif(btrim(p_note), ''), v_uid,
    case when v_status = 'confirmed' then v_uid end,
    case when v_status = 'confirmed' then now() end,
    p_idempotency_key, p_periods
  )
  returning id into v_id;
  return v_id;
end;
$$;

create function public.register_personal_payment(
  p_subscription_id uuid,
  p_amount_cents bigint,
  p_occurred_on date,
  p_renewal_date date,
  p_concept text,
  p_idempotency_key uuid,
  p_periods smallint
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
  if p_periods is null or p_periods not between 1 and 24 then
    raise exception 'invalid_periods';
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
    concept, created_by, idempotency_key, periods
  )
  values (
    p_subscription_id, 'personal_payment', p_amount_cents, v_currency, p_occurred_on, p_renewal_date,
    nullif(btrim(p_concept), ''), v_uid, p_idempotency_key, p_periods
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_member_payment(uuid, date, bigint, date, text, uuid, smallint) from public, anon;
revoke all on function public.register_personal_payment(uuid, bigint, date, date, text, uuid, smallint) from public, anon;
grant execute on function public.record_member_payment(uuid, date, bigint, date, text, uuid, smallint) to authenticated;
grant execute on function public.register_personal_payment(uuid, bigint, date, date, text, uuid, smallint) to authenticated;
