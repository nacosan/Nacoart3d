/**
 * Cobros dentro de un grupo. Funciones puras: "hoy" se pasa como argumento.
 *
 * - Cada renovación del plan es un plazo para cada miembro (no para el líder).
 * - Su importe es el precio de esa fecha repartido entre quienes estaban en el
 *   grupo ese día; el líder asume los céntimos sobrantes. Entrar o salir del
 *   grupo no cambia lo que se debía antes.
 * - Un miembro debe desde la renovación del periodo en que entró.
 * - Solo cuentan los pagos confirmados. Uno declarado se muestra "por confirmar".
 */
import { addDays, daysBetween, scheduleBetween, type ISODate } from "../finance/dates.ts";
import type { Cents } from "../finance/money.ts";
import { isRunning, priceOn, type PersonalSubscription } from "./personal.ts";

/** Días de margen después de la renovación antes de considerar un plazo vencido. */
export const GRACE_DAYS = 7;

export interface MembershipRow {
  id: string;
  role: "leader" | "member";
  joinedOn: ISODate;
  /** Día en que dejó de estar (no incluido). null si sigue. */
  leftOn: ISODate | null;
}

export interface MemberPaymentRow {
  id: string;
  memberId: string;
  renewalDate: ISODate;
  amountCents: Cents;
  paidOn: ISODate;
  status: "declared" | "confirmed" | "rejected" | "voided";
  note: string | null;
}

export type InstallmentStatus = "paid" | "partial" | "awaiting" | "pending" | "overdue" | "upcoming";

export interface Installment {
  memberId: string;
  date: ISODate;
  due: Cents;
  confirmed: Cents;
  declared: Cents;
  status: InstallmentStatus;
}

function activeOn(member: MembershipRow, date: ISODate): boolean {
  return member.joinedOn <= date && (member.leftOn === null || member.leftOn > date);
}

/**
 * Renovación del periodo en que entró: la última fecha del calendario igual o
 * anterior a su entrada (o el ancla, si entró antes de empezar).
 */
export function firstRenewalFor(sub: PersonalSubscription, member: MembershipRow): ISODate {
  if (member.joinedOn <= sub.renewalAnchor) return sub.renewalAnchor;
  const dates = scheduleBetween(sub.renewalAnchor, sub.billingPeriod, sub.renewalAnchor, member.joinedOn);
  return dates[dates.length - 1] ?? sub.renewalAnchor;
}

/** Parte de un miembro en una renovación, con quienes estaban en el grupo ese día. */
export function shareOn(sub: PersonalSubscription, members: MembershipRow[], member: MembershipRow, date: ISODate): Cents {
  // Para el periodo en que entró cuenta como presente desde el inicio de ese periodo.
  const present = (row: MembershipRow) => activeOn(row, date) || firstRenewalFor(sub, row) === date;
  if (!present(member)) return 0;
  const count = Math.max(1, members.filter(present).length);
  const total = priceOn(sub.prices, date);
  const base = Math.floor(total / count);
  return member.role === "leader" ? total - base * (count - 1) : base;
}

/**
 * Plazos de un miembro: renovaciones desde que entró hasta hoy, más la próxima.
 * Se cortan al salir del grupo, al pausar o al cancelar.
 */
export function installmentsFor(
  sub: PersonalSubscription,
  members: MembershipRow[],
  member: MembershipRow,
  payments: MemberPaymentRow[],
  today: ISODate,
): Installment[] {
  if (member.role !== "member") return [];
  const from = firstRenewalFor(sub, member);
  let until = isRunning(sub) ? addDays(today, sub.billingPeriod === "monthly" ? 31 : 366) : today;
  if (member.leftOn && addDays(member.leftOn, -1) < until) until = addDays(member.leftOn, -1);
  if (sub.status === "cancelled" && sub.cancelledOn && addDays(sub.cancelledOn, -1) < until) until = addDays(sub.cancelledOn, -1);

  const dates = scheduleBetween(sub.renewalAnchor, sub.billingPeriod, from, until);
  // Solo una renovación futura: la próxima.
  const firstFuture = dates.findIndex((date) => date > today);
  const shown = firstFuture === -1 ? dates : dates.slice(0, firstFuture + 1);

  return shown.map((date) => {
    const due = shareOn(sub, members, member, date);
    const mine = payments.filter((payment) => payment.memberId === member.id && payment.renewalDate === date);
    const confirmed = mine.filter((payment) => payment.status === "confirmed").reduce((sum, payment) => sum + payment.amountCents, 0);
    const declared = mine.filter((payment) => payment.status === "declared").reduce((sum, payment) => sum + payment.amountCents, 0);
    let status: InstallmentStatus;
    if (due > 0 && confirmed >= due) status = "paid";
    else if (confirmed > 0) status = "partial";
    else if (declared > 0) status = "awaiting";
    else if (date > today) status = "upcoming";
    else if (daysBetween(date, today) > GRACE_DAYS) status = "overdue";
    else status = "pending";
    return { memberId: member.id, date, due, confirmed, declared, status };
  });
}

export interface MemberBalance {
  /** Pendiente de plazos ya vencidos (pasado el margen). */
  overdue: Cents;
  /** Pendiente de plazos de este periodo, aún en plazo. */
  pending: Cents;
  /** Declarado por el miembro y sin confirmar. */
  awaiting: Cents;
}

export function balanceOf(installments: Installment[], today: ISODate): MemberBalance {
  const result: MemberBalance = { overdue: 0, pending: 0, awaiting: 0 };
  for (const item of installments) {
    if (item.status === "paid" || item.status === "upcoming") continue;
    if (item.status === "awaiting") {
      result.awaiting += item.declared;
      continue;
    }
    const left = Math.max(0, item.due - item.confirmed);
    if (daysBetween(item.date, today) > GRACE_DAYS) result.overdue += left;
    else result.pending += left;
  }
  return result;
}
