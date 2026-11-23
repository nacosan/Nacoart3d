-- Fase 3c: participar como miembro en un plan que paga otra persona.
--
-- Al añadir una suscripción familiar o compartida, la persona elige:
--   * propietario: la paga ella al servicio (grupo de la fase 3a, sin cambios);
--   * miembro: la paga otra persona (que no usa la app o no la ha invitado) y
--     ella le paga su parte. Se guarda el precio total del plan (historial de
--     precios) y, aparte, su parte (my_share_cents), que es lo que cuenta como
--     su gasto. Los pagos que anota son los que hace a quien paga el plan.
-- Si quien paga el plan usa la app, lo recomendable es la invitación (fase 3a).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'participation'
  ) then
    raise exception 'La fase 3c ya está aplicada.';
  end if;
end
$$;

alter table public.subscriptions
  add column participation text not null default 'owner' check (participation in ('owner', 'member')),
  add column my_share_cents bigint check (my_share_cents is null or my_share_cents > 0),
  add column plan_owner_name text check (plan_owner_name is null or char_length(btrim(plan_owner_name)) between 1 and 60);

alter table public.subscriptions add constraint subscriptions_member_participation check (
  (participation = 'owner' and my_share_cents is null and plan_owner_name is null)
  or (participation = 'member' and mode = 'personal' and my_share_cents is not null)
);

-- La persona puede corregir su parte y el nombre de quien paga el plan.
grant update (my_share_cents, plan_owner_name) on table public.subscriptions to authenticated;

-- create_subscription gana tres parámetros: se sustituye la versión de la fase 3a.
drop function public.create_subscription(text, text, text, text, date, text, bigint, text, text, uuid, text, boolean, smallint, text[], text[]);

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
  p_invite_emails text[],
  p_participation text,
  p_my_share_cents bigint,
  p_plan_owner_name text
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
  if coalesce(p_participation, 'owner') not in ('owner', 'member') then
    raise exception 'invalid_participation';
  end if;
  -- Miembro de un plan que paga otra persona: su parte, sin grupo en la app.
  if p_participation = 'member' then
    if coalesce(p_shared, false) then
      raise exception 'invalid_participation';
    end if;
    if p_my_share_cents is null or p_my_share_cents <= 0 or p_my_share_cents > p_amount_cents then
      raise exception 'invalid_share';
    end if;
    if p_plan_owner_name is not null and char_length(btrim(p_plan_owner_name)) > 60 then
      raise exception 'invalid_guest';
    end if;
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
    status, manage_url, notes, idempotency_key, plan_id, max_members,
    participation, my_share_cents, plan_owner_name
  )
  values (
    v_uid,
    case when coalesce(p_shared, false) then 'shared' else 'personal' end,
    btrim(p_name), p_category_id, p_currency, p_billing_period, p_renewal_anchor,
    p_status, nullif(btrim(p_manage_url), ''), nullif(btrim(p_notes), ''), p_idempotency_key,
    p_plan_id, case when coalesce(p_shared, false) then v_max end,
    coalesce(p_participation, 'owner'),
    case when p_participation = 'member' then p_my_share_cents end,
    case when p_participation = 'member' then nullif(btrim(p_plan_owner_name), '') end
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

revoke all on function public.create_subscription(text, text, text, text, date, text, bigint, text, text, uuid, text, boolean, smallint, text[], text[], text, bigint, text) from public, anon;
grant execute on function public.create_subscription(text, text, text, text, date, text, bigint, text, text, uuid, text, boolean, smallint, text[], text[], text, bigint, text) to authenticated;
