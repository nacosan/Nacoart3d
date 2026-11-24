import { reviewMemberPayment, voidMemberPayment } from "@/app/(app)/grupos/actions";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Panel } from "@/components/ui/Panel";
import type { GroupMember } from "@/lib/data/groups";
import { formatDay, formatMonthShort } from "@/lib/finance/dates";
import { centsToInput, formatMoney } from "@/lib/finance/money";
import {
  GRACE_DAYS,
  balanceOf,
  installmentsFor,
  type Installment,
  type MemberPaymentRow,
  type MembershipRow,
} from "@/lib/subscriptions/collections";
import type { PersonalSubscription } from "@/lib/subscriptions/personal";
import { PaymentRecordForm, type PayableMember } from "./PaymentRecordForm";

function periodLabel(sub: PersonalSubscription, date: string) {
  return sub.billingPeriod === "monthly" ? formatMonthShort(date) : `Año desde ${formatDay(date, true)}`;
}

function coverLabel(sub: PersonalSubscription, payment: MemberPaymentRow) {
  if (payment.periods <= 1) return periodLabel(sub, payment.renewalDate);
  return `${payment.periods === 12 ? "Todo el año" : `${payment.periods} meses`} desde ${periodLabel(sub, payment.renewalDate)}`;
}

function payableFrom(sub: PersonalSubscription, installments: Installment[]): PayableMember["periods"] {
  return installments
    .filter((item) => item.status !== "paid" && item.due > item.confirmed)
    .map((item) => ({
      date: item.date,
      label: `${periodLabel(sub, item.date)} · ${formatMoney(item.due - item.confirmed, sub.currency)}${item.status === "upcoming" ? " (por adelantado)" : ""}`,
      amount: centsToInput(item.due - item.confirmed),
    }));
}

export function CollectionsPanel({
  sub,
  members,
  memberships,
  payments,
  today,
  setupMissing,
  defaultMemberId,
  defaultRenewal,
}: {
  sub: PersonalSubscription;
  members: GroupMember[];
  memberships: MembershipRow[];
  payments: MemberPaymentRow[];
  today: string;
  setupMissing: boolean;
  defaultMemberId?: string;
  defaultRenewal?: string;
}) {
  if (setupMissing) {
    return (
      <Panel title="Cobros" titleId="cobros">
        <p className="rounded-inner bg-warning-soft px-4 py-3 text-small text-warning-ink">
          Falta aplicar la migración de cobros en Supabase para ver quién te ha pagado.
        </p>
      </Panel>
    );
  }

  const leader = sub.role === "leader";
  const names = new Map(members.map((member) => [member.memberId, member]));
  // El líder ve a todos los miembros (también a quien ya salió si tenía plazos); un miembro, solo a sí mismo.
  const rows = memberships
    .filter((row) => row.role === "member")
    .filter((row) => (leader ? true : names.get(row.id)?.isMe))
    .map((row) => ({ row, installments: installmentsFor(sub, memberships, row, payments, today) }))
    .filter(({ row, installments }) => installments.length > 0 || names.has(row.id));

  if (rows.length === 0) {
    return (
      <Panel title={leader ? "Cobros" : "Tus pagos"} titleId="cobros">
        <p className="rounded-inner bg-raised p-4 text-small text-muted">
          {leader ? "Cuando añadas personas al grupo, aquí verás quién te ha pagado su parte." : "Aún no tienes pagos en este grupo."}
        </p>
      </Panel>
    );
  }

  const totals = rows.reduce(
    (sum, { installments }) => {
      const balance = balanceOf(installments, today);
      return { overdue: sum.overdue + balance.overdue, pending: sum.pending + balance.pending, awaiting: sum.awaiting + balance.awaiting };
    },
    { overdue: 0, pending: 0, awaiting: 0 },
  );
  const declared = payments.filter((payment) => payment.status === "declared");
  const recent = payments
    .filter((payment) => payment.status === "confirmed")
    .sort((a, b) => (a.paidOn < b.paidOn ? 1 : -1))
    .slice(0, 8);
  const nameOf = (memberId: string) => names.get(memberId)?.displayName ?? "Participante anterior";
  const payable: PayableMember[] = rows
    .filter(({ row }) => names.has(row.id))
    .map(({ row, installments }) => ({ id: row.id, name: nameOf(row.id), periods: payableFrom(sub, installments) }));

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-small">
        <p>
          {leader ? "Te deben" : "Debes"}{" "}
          <Money cents={totals.overdue} currency={sub.currency} className={`font-semibold ${totals.overdue > 0 ? "text-negative-ink" : ""}`} />{" "}
          <span className="text-muted">vencido</span>
        </p>
        <p>
          <Money cents={totals.pending} currency={sub.currency} className="font-semibold" /> <span className="text-muted">en plazo</span>
        </p>
        {totals.awaiting > 0 ? (
          <p>
            <Money cents={totals.awaiting} currency={sub.currency} className="font-semibold" />{" "}
            <span className="text-muted">por confirmar</span>
          </p>
        ) : null}
      </div>

      {leader && declared.length > 0 ? (
        <section aria-labelledby="por-confirmar" className="mt-5 rounded-inner bg-accent-soft p-4">
          <h3 id="por-confirmar" className="flex items-center gap-2 text-small font-semibold text-accent-ink">
            <Icon name="hourglass" /> Por confirmar
          </h3>
          <ul className="mt-2 flex flex-col">
            {declared.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-3 border-b border-accent/15 py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1 text-small">
                  <p className="font-semibold">
                    {nameOf(payment.memberId)} dice que ha pagado <Money cents={payment.amountCents} currency={sub.currency} />
                  </p>
                  <p className="text-[0.8125rem] text-muted">
                    {coverLabel(sub, payment)} · enviado el {formatDay(payment.paidOn, true)}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </p>
                </div>
                <form action={reviewMemberPayment.bind(null, sub.id, payment.id, false, "suscripcion")}>
                  <SubmitButton variant="secondary" pendingLabel="…" className="h-9 px-4">
                    Rechazar
                  </SubmitButton>
                </form>
                <form action={reviewMemberPayment.bind(null, sub.id, payment.id, true, "suscripcion")}>
                  <SubmitButton icon="check" pendingLabel="…" className="h-9 px-4">
                    Confirmar
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-3 text-[0.8125rem] text-muted">
        Un pago cuenta como vencido {GRACE_DAYS} días después de la renovación.
        {leader ? " Los pagos que declaran los demás no cuentan hasta que los confirmas." : ""}
      </p>

      {payable.length > 0 ? (
        <section aria-labelledby="anotar-cobro" className="mt-5 rounded-inner bg-raised p-4">
          <h3 id="anotar-cobro" className="mb-3 flex items-center gap-2 text-small font-semibold">
            <Icon name={leader ? "plus" : "send"} /> {leader ? "Anotar un cobro" : "He enviado un pago"}
          </h3>
          <PaymentRecordForm
            subscriptionId={sub.id}
            members={payable}
            idempotencyKey={crypto.randomUUID()}
            today={today}
            asMember={!leader}
            billingPeriod={sub.billingPeriod}
            defaultMemberId={defaultMemberId}
            defaultRenewal={defaultRenewal}
            currency={sub.currency}
          />
        </section>
      ) : null}

      {leader && recent.length > 0 ? (
        <details className="group mt-3 rounded-inner border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-inner px-4 py-3 text-small font-semibold text-muted [&::-webkit-details-marker]:hidden">
            Últimos cobros
            <Icon name="chevron" className="transition-transform duration-150 group-open:rotate-90" />
          </summary>
          <ul className="flex flex-col px-4 pb-3">
            {recent.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-3 border-b border-rule py-2.5 text-small last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{nameOf(payment.memberId)}</p>
                  <p className="text-[0.8125rem] text-muted">
                    {coverLabel(sub, payment)} · {formatDay(payment.paidOn, true)}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </p>
                </div>
                <Money cents={payment.amountCents} currency={sub.currency} className="font-semibold" />
                <form action={voidMemberPayment.bind(null, sub.id, payment.id)}>
                  <button type="submit" className="rounded-full px-2 py-1 text-[0.8125rem] font-medium text-muted hover:bg-active hover:text-ink">
                    Anular
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
