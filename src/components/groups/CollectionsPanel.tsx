import { reviewMemberPayment, voidMemberPayment } from "@/app/(app)/grupos/actions";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Panel } from "@/components/ui/Panel";
import { Pill, type Tone } from "@/components/ui/Pill";
import type { GroupMember } from "@/lib/data/groups";
import { initialsOf } from "@/lib/data/profile";
import { formatDay, formatMonthShort } from "@/lib/finance/dates";
import { centsToInput, formatMoney, type Currency } from "@/lib/finance/money";
import {
  GRACE_DAYS,
  balanceOf,
  installmentsFor,
  type Installment,
  type InstallmentStatus,
  type MemberPaymentRow,
  type MembershipRow,
} from "@/lib/subscriptions/collections";
import type { PersonalSubscription } from "@/lib/subscriptions/personal";
import { PaymentRecordForm, type PayableMember } from "./PaymentRecordForm";
import { memberColors } from "./ShareDonut";

/** Cada estado lleva icono y texto, no solo color. */
const STATUS: Record<InstallmentStatus, { label: string; tone: Tone; icon: IconName }> = {
  paid: { label: "Pagado", tone: "positive", icon: "check" },
  partial: { label: "Parcial", tone: "warning", icon: "half" },
  awaiting: { label: "Por confirmar", tone: "accent", icon: "hourglass" },
  pending: { label: "Pendiente", tone: "neutral", icon: "clock" },
  overdue: { label: "Vencido", tone: "negative", icon: "alert" },
  upcoming: { label: "Próximo", tone: "outline", icon: "calendar" },
};

/** Cuántas renovaciones se ven en la tabla (las más recientes). */
const COLUMNS = 6;

function periodLabel(sub: PersonalSubscription, date: string) {
  return sub.billingPeriod === "monthly" ? formatMonthShort(date) : `Año desde ${formatDay(date, true)}`;
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

function Cell({ item, currency }: { item: Installment | undefined; currency: Currency }) {
  if (!item) return <span className="text-muted">—</span>;
  const status = STATUS[item.status];
  return (
    <span className="flex flex-col items-start gap-1">
      <Pill tone={status.tone} icon={status.icon}>
        {status.label}
      </Pill>
      <span className="text-[0.8125rem] text-muted tabular-nums">
        {item.status === "partial" ? `${formatMoney(item.confirmed, currency)} de ` : ""}
        {formatMoney(item.due, currency)}
      </span>
    </span>
  );
}

export function CollectionsPanel({
  sub,
  members,
  memberships,
  payments,
  today,
  setupMissing,
}: {
  sub: PersonalSubscription;
  members: GroupMember[];
  memberships: MembershipRow[];
  payments: MemberPaymentRow[];
  today: string;
  setupMissing: boolean;
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
  const colors = memberColors(members);
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

  const dates = [...new Set(rows.flatMap(({ installments }) => installments.map((item) => item.date)))].sort().slice(-COLUMNS);
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
    <Panel title={leader ? "Cobros" : "Tus pagos"} titleId="cobros" aside={leader ? "Solo lo ves tú" : null}>
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
                    {periodLabel(sub, payment.renewalDate)} · enviado el {formatDay(payment.paidOn, true)}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </p>
                </div>
                <form action={reviewMemberPayment.bind(null, sub.id, payment.id, false)}>
                  <SubmitButton variant="secondary" pendingLabel="…" className="h-9 px-4">
                    Rechazar
                  </SubmitButton>
                </form>
                <form action={reviewMemberPayment.bind(null, sub.id, payment.id, true)}>
                  <SubmitButton icon="check" pendingLabel="…" className="h-9 px-4">
                    Confirmar
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-small">
          <caption className="sr-only">Estado de los pagos de cada persona en las últimas renovaciones</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-surface py-2 pr-4 text-left font-semibold text-muted">
                Persona
              </th>
              {dates.map((date) => (
                <th key={date} scope="col" className={`px-2 py-2 text-left font-semibold ${date > today ? "text-muted" : ""}`}>
                  {periodLabel(sub, date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, installments }) => {
              const member = names.get(row.id);
              return (
                <tr key={row.id}>
                  <th scope="row" className="sticky left-0 border-t border-rule bg-surface py-3 pr-4 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <Avatar
                        initials={initialsOf(member?.displayName ?? "?")}
                        hue={colors.get(row.id) ?? "verde"}
                        size="sm"
                        guest={member?.isGuest ?? false}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold break-words">{member?.isMe ? "Tú" : nameOf(row.id)}</span>
                        {member?.isGuest ? <span className="block text-[0.8125rem] text-muted">Sin cuenta</span> : null}
                        {!member ? <span className="block text-[0.8125rem] text-muted">Ya no está en el grupo</span> : null}
                      </span>
                    </span>
                  </th>
                  {dates.map((date) => (
                    <td key={date} className="border-t border-rule px-2 py-3 align-top">
                      <Cell item={installments.find((item) => item.date === date)} currency={sub.currency} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.8125rem] text-muted">
        Un pago cuenta como vencido {GRACE_DAYS} días después de la renovación.
        {leader ? " Los pagos que declaran los demás no cuentan hasta que los confirmas." : ""}
      </p>

      {payable.length > 0 ? (
        <details className="group mt-5 rounded-inner bg-raised">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-inner px-4 py-3 text-small font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Icon name={leader ? "plus" : "send"} /> {leader ? "Anotar un cobro" : "He enviado un pago"}
            </span>
            <Icon name="chevron" className="transition-transform duration-150 group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4 pt-2">
            <PaymentRecordForm
              subscriptionId={sub.id}
              members={payable}
              idempotencyKey={crypto.randomUUID()}
              today={today}
              asMember={!leader}
            />
          </div>
        </details>
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
                    {periodLabel(sub, payment.renewalDate)} · {formatDay(payment.paidOn, true)}
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
    </Panel>
  );
}
