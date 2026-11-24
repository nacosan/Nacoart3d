/**
 * Cobros y calendario de pagos. Funciones puras: "hoy" se pasa como argumento.
 *
 * - Cada renovación del plan es un plazo. En un grupo, uno por miembro (el
 *   líder no se debe a sí mismo); en una suscripción propia, uno para ti.
 * - En un grupo, el importe es el precio de esa fecha repartido entre quienes
 *   estaban ese día; el líder asume los céntimos sobrantes. Entrar o salir del
 *   grupo no cambia lo que se debía antes.
 * - Un pago puede cubrir varias renovaciones seguidas (por ejemplo, 12 = un
 *   año de un plan mensual). Su importe se reparte entre ellas en orden.
 * - Solo cuentan los pagos confirmados. Uno declarado se muestra "por confirmar".
 */
import { addDays, addMonths, daysBetween, parseISODate, scheduleBetween, type ISODate } from "../finance/dates.ts";
import type { Cents } from "../finance/money.ts";
import { effectivePayments, isRunning, payableOn, priceOn, type PersonalSubscription } from "./personal.ts";

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
  /** Renovaciones seguidas que cubre, empezando en renewalDate. */
  periods: number;
  amountCents: Cents;
  paidOn: ISODate;
  status: "declared" | "confirmed" | "rejected" | "voided";
  note: string | null;
}

/** Pago que cubre una o varias renovaciones (de un miembro o tuyo). */
export interface CoverPayment {
  id: string;
  renewalDate: ISODate;
  periods: number;
  amountCents: Cents;
  paidOn: ISODate;
  status: "declared" | "confirmed" | "rejected" | "voided";
}

export type InstallmentStatus = "paid" | "partial" | "awaiting" | "pending" | "overdue" | "upcoming";

export interface Installment {
  /** Miembro del grupo, o "yo" en una suscripción propia. */
  memberId: string;
  /** Fecha de la renovación. */
  date: ISODate;
  /** Siguiente renovación: el plazo cubre [date, end). */
  end: ISODate;
  due: Cents;
  confirmed: Cents;
  declared: Cents;
  status: InstallmentStatus;
  /** Fecha del último pago confirmado (o declarado, si no hay) que lo cubre. */
  paidOn: ISODate | null;
  /** Pago confirmado que lo cubre y cuántas renovaciones abarca ese pago. */
  paymentId: string | null;
  paymentPeriods: number;
}

function activeOn(member: MembershipRow, date: ISODate): boolean {
  return member.joinedOn <= date && (member.leftOn === null || member.leftOn > date);
}

const PERIOD_MONTHS = { monthly: 1, yearly: 12 } as const;

function nextRenewal(sub: PersonalSubscription, date: ISODate): ISODate {
  // Margen de unos días: con anclas a final de mes, la siguiente puede caer después de "fecha + 1 mes".
  const window = addDays(addMonths(date, PERIOD_MONTHS[sub.billingPeriod]), 4);
  return scheduleBetween(sub.renewalAnchor, sub.billingPeriod, addDays(date, 1), window)[0];
}

/** Renovación del periodo que contiene una fecha (o el ancla, si es anterior). */
function renewalOnOrBefore(sub: PersonalSubscription, date: ISODate): ISODate {
  if (date <= sub.renewalAnchor) return sub.renewalAnchor;
  const dates = scheduleBetween(sub.renewalAnchor, sub.billingPeriod, sub.renewalAnchor, date);
  return dates[dates.length - 1] ?? sub.renewalAnchor;
}

/** Renovación del periodo en que entró: la última fecha del calendario igual o anterior a su entrada. */
export function firstRenewalFor(sub: PersonalSubscription, member: MembershipRow): ISODate {
  return renewalOnOrBefore(sub, member.joinedOn);
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

/** Renovaciones que cubre un pago: `periods` fechas seguidas desde la suya. */
function coveredDates(sub: PersonalSubscription, payment: CoverPayment): ISODate[] {
  const months = PERIOD_MONTHS[sub.billingPeriod] * payment.periods;
  // Margen de unos días por los finales de mes; slice deja exactamente `periods` fechas.
  const until = addDays(addMonths(payment.renewalDate, months), 4);
  return scheduleBetween(sub.renewalAnchor, sub.billingPeriod, payment.renewalDate, until).slice(0, payment.periods);
}

/** Reparte cada pago entre las renovaciones que cubre y calcula el estado de cada plazo. */
function buildInstallments(
  sub: PersonalSubscription,
  memberId: string,
  dates: ISODate[],
  dueOf: (date: ISODate) => Cents,
  payments: CoverPayment[],
  today: ISODate,
): Installment[] {
  const slots = new Map(
    dates.map((date) => [
      date,
      { due: dueOf(date), confirmed: 0, declared: 0, paidOn: null as ISODate | null, paymentId: null as string | null, paymentPeriods: 1 },
    ]),
  );
  const ordered = [...payments].sort((a, b) => (a.paidOn < b.paidOn ? -1 : a.paidOn > b.paidOn ? 1 : 0));
  for (const payment of ordered) {
    if (payment.status !== "confirmed" && payment.status !== "declared") continue;
    const covered = coveredDates(sub, payment);
    let left = payment.amountCents;
    covered.forEach((date, index) => {
      const slot = slots.get(date);
      const due = slot?.due ?? dueOf(date);
      // El último periodo cubierto se queda con lo que sobre (redondeos).
      const part = index === covered.length - 1 ? left : Math.min(left, due);
      left -= part;
      if (!slot) return;
      if (payment.status === "confirmed") {
        slot.confirmed += part;
        slot.paidOn = payment.paidOn;
        slot.paymentId = payment.id;
        slot.paymentPeriods = payment.periods;
      } else {
        slot.declared += part;
        if (!slot.paidOn) slot.paidOn = payment.paidOn;
      }
    });
  }

  return dates.map((date) => {
    const slot = slots.get(date)!;
    let status: InstallmentStatus;
    if (slot.due > 0 && slot.confirmed >= slot.due) status = "paid";
    else if (slot.confirmed > 0) status = "partial";
    else if (slot.declared > 0) status = "awaiting";
    else if (date > today) status = "upcoming";
    else if (daysBetween(date, today) > GRACE_DAYS) status = "overdue";
    else status = "pending";
    return {
      memberId,
      date,
      end: nextRenewal(sub, date),
      due: slot.due,
      confirmed: slot.confirmed,
      declared: slot.declared,
      status,
      paidOn: slot.paidOn,
      paymentId: slot.paymentId,
      paymentPeriods: slot.paymentPeriods,
    };
  });
}

/** Fechas de renovación de un tramo, cortadas al pausar, cancelar o salir. */
function datesBetween(sub: PersonalSubscription, from: ISODate, today: ISODate, until: ISODate | undefined, leftOn: ISODate | null) {
  let last = until ?? (isRunning(sub) ? addDays(today, sub.billingPeriod === "monthly" ? 31 : 366) : today);
  if (!isRunning(sub) && last > today) last = today;
  if (leftOn && addDays(leftOn, -1) < last) last = addDays(leftOn, -1);
  if (sub.status === "cancelled" && sub.cancelledOn && addDays(sub.cancelledOn, -1) < last) last = addDays(sub.cancelledOn, -1);
  const dates = scheduleBetween(sub.renewalAnchor, sub.billingPeriod, from, last);
  if (until) return dates;
  // Sin límite explícito: hasta hoy y la próxima renovación.
  const firstFuture = dates.findIndex((date) => date > today);
  return firstFuture === -1 ? dates : dates.slice(0, firstFuture + 1);
}

/**
 * Plazos de un miembro del grupo: desde que entró hasta hoy, más la próxima
 * renovación; o hasta `until`, si se indica (para el calendario).
 */
export function installmentsFor(
  sub: PersonalSubscription,
  members: MembershipRow[],
  member: MembershipRow,
  payments: MemberPaymentRow[],
  today: ISODate,
  until?: ISODate,
): Installment[] {
  if (member.role !== "member") return [];
  const dates = datesBetween(sub, firstRenewalFor(sub, member), today, until, member.leftOn);
  const mine = payments.filter((payment) => payment.memberId === member.id);
  return buildInstallments(sub, member.id, dates, (date) => shareOn(sub, members, member, date), mine, today);
}

/**
 * Tus plazos en una suscripción propia (o como miembro de un plan que paga
 * otra persona): desde que la diste de alta, con los pagos que has anotado.
 */
export function ownInstallments(sub: PersonalSubscription, today: ISODate, until?: ISODate): Installment[] {
  const from = renewalOnOrBefore(sub, sub.trackingFrom > sub.renewalAnchor ? sub.trackingFrom : sub.renewalAnchor);
  const dates = datesBetween(sub, from, today, until, null);
  const payments: CoverPayment[] = effectivePayments(sub.entries)
    .filter((entry) => entry.renewalDate !== null)
    .map((entry) => ({
      id: entry.id,
      renewalDate: entry.renewalDate as ISODate,
      periods: entry.periods ?? 1,
      amountCents: entry.amountCents,
      paidOn: entry.occurredOn,
      status: "confirmed",
    }));
  return buildInstallments(sub, "yo", dates, (date) => payableOn(sub, date), payments, today);
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

/* ------------------------------------------------------------------ */
/* Calendario de pagos                                                 */
/* ------------------------------------------------------------------ */

export interface CalendarSegment {
  /** Columna de inicio (1 = primer mes del rango) y meses que ocupa dentro del rango. */
  startCol: number;
  span: number;
  status: InstallmentStatus;
  /** Un solo pago que cubre varias renovaciones (por ejemplo, el año entero). */
  grouped: boolean;
  /** Renovaciones que abarca el tramo. */
  periods: number;
  /** Primera renovación del tramo y último día cubierto. */
  from: ISODate;
  through: ISODate;
  paidOn: ISODate | null;
  /** Último pago confirmado del tramo (para poder anularlo si fue un error). */
  paymentId: string | null;
  due: Cents;
  confirmed: Cents;
  declared: Cents;
}

/** Índice absoluto de un mes (año × 12 + mes − 1), para rangos que cruzan de año. */
export function monthIndex(year: number, month: number): number {
  return year * 12 + month - 1;
}

/**
 * Tramos de un rango de meses para una fila del calendario. Cada plazo ocupa
 * el mes de su renovación (o 12 meses en un plan anual); varios plazos pagados
 * con un mismo pago se juntan en un único tramo.
 */
export function calendarSegments(
  installments: Installment[],
  rangeStart: number,
  rangeLength: number,
  billingPeriod: "monthly" | "yearly",
): CalendarSegment[] {
  const groups: Installment[][] = [];
  for (const item of installments) {
    const previous = groups[groups.length - 1];
    const last = previous?.[previous.length - 1];
    if (last && item.paymentId && item.paymentId === last.paymentId && item.paymentPeriods > 1) previous.push(item);
    else groups.push([item]);
  }

  const rangeEnd = rangeStart + rangeLength - 1;
  const segments: CalendarSegment[] = [];
  for (const group of groups) {
    const first = group[0];
    const lastItem = group[group.length - 1];
    const start = parseISODate(first.date);
    const startIndex = monthIndex(start.year, start.month);
    const endIndex = startIndex + PERIOD_MONTHS[billingPeriod] * group.length - 1;
    const from = Math.max(startIndex, rangeStart);
    const to = Math.min(endIndex, rangeEnd);
    if (from > to) continue;
    segments.push({
      startCol: from - rangeStart + 1,
      span: to - from + 1,
      status: first.status,
      grouped: group.length > 1,
      periods: group.length,
      from: first.date,
      through: addDays(lastItem.end, -1),
      paidOn: lastItem.paidOn,
      paymentId: lastItem.paymentId,
      due: group.reduce((sum, item) => sum + item.due, 0),
      confirmed: group.reduce((sum, item) => sum + item.confirmed, 0),
      declared: group.reduce((sum, item) => sum + item.declared, 0),
    });
  }
  return segments;
}
