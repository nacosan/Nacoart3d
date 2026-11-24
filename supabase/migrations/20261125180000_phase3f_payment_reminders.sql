-- Fase 3f: recordatorios de pago dentro de la app.
--
-- Quien paga un plan compartido puede recordar a un miembro CON cuenta que
-- tiene pendiente una renovación. El miembro lo ve en su Resumen hasta que lo
-- cierra. Como mucho un recordatorio al día por miembro y renovación.
-- A los invitados sin cuenta la app no les puede avisar (se copia un mensaje).
-- El envío por correo queda fuera: necesita un proveedor de email configurado.

do $$
begin
  if to_regclass('public.payment_reminders') is not null then
    raise exception 'public.payment_reminders ya existe.';
  end if;
end
$$;

create table public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  member_id uuid not null references public.subscription_members (id) on delete cascade,
  renewal_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  sent_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);

create index payment_reminders_member_idx on public.payment_reminders (member_id) where dismissed_at is null;
create index payment_reminders_subscription_idx on public.payment_reminders (subscription_id);
create index payment_reminders_sent_by_idx on public.payment_reminders (sent_by);

alter table public.payment_reminders enable row level security;
revoke all on table public.payment_reminders from anon, authenticated;
grant select on table public.payment_reminders to authenticated;

create policy payment_reminders_select on public.payment_reminders
  for select to authenticated
  using (public.is_subscription_owner(subscription_id) or public.is_own_membership(member_id));

create function public.send_payment_reminder(p_member_id uuid, p_renewal_date date, p_amount_cents bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.subscription_members%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_renewal_date is null then
    raise exception 'invalid_amount';
  end if;

  select m.* into v_member
  from public.subscription_members m
  join public.subscriptions s on s.id = m.subscription_id
  where m.id = p_member_id and s.owner_id = v_uid and m.role = 'member' and m.status = 'active';
  if v_member.id is null then
    raise exception 'not_found';
  end if;
  if v_member.user_id is null then
    raise exception 'guest_member';
  end if;

  -- Como mucho uno al día por miembro y renovación.
  select id into v_id from public.payment_reminders
  where member_id = p_member_id and renewal_date = p_renewal_date and created_at > now() - interval '1 day';
  if v_id is not null then
    return v_id;
  end if;

  insert into public.payment_reminders (subscription_id, member_id, renewal_date, amount_cents, sent_by)
  values (v_member.subscription_id, p_member_id, p_renewal_date, p_amount_cents, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.dismiss_payment_reminder(p_reminder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.payment_reminders set dismissed_at = now()
  where id = p_reminder_id and dismissed_at is null and public.is_own_membership(member_id);
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.send_payment_reminder(uuid, date, bigint) from public, anon;
revoke all on function public.dismiss_payment_reminder(uuid) from public, anon;
grant execute on function public.send_payment_reminder(uuid, date, bigint) to authenticated;
grant execute on function public.dismiss_payment_reminder(uuid) to authenticated;
