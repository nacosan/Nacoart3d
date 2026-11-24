/**
 * Cálculos de las suscripciones personales a partir de las filas de la base de
 * datos. Son funciones puras: la fecha de "hoy" se pasa siempre como argumento.
 *
 * Tres listas que nunca se mezclan (docs/propuesta-mvp.md §2.4):
 *   - previsiones: fechas del calendario contratado a partir de hoy;
 *   - renovaciones sin pago registrado: fechas pasadas del calendario sin pago;
 *   - historial real: solo los pagos que alguien ha registrado.
 */
import type { CategoryId } from "../catalog.ts";
import { addDays, addMonths, monthKey, nextScheduleDate, scheduleBetween, toISODate, parseISODate, type ISODate } from "../finance/dates.ts";
import { annualEquivalent, monthlyEquivalent, sumCents, type BillingPeriod, type Cents, type Currency } from "../finance/money.ts";

export type SubscriptionStatus = "active" | "trial" | "paused" | "cancelled";

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Activa",
  trial: "En prueba",
  paused: "Pausada",
  cancelled: "Cancelada",
};

export const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: "Mensual",
  yearly: "Anual",
};

export interface PriceRow {
  amountCents: Cents;
  effectiveFrom: ISODate;
}

export interface LedgerRow {
  id: string;
  kind: "personal_payment" | "void";
  amountCents: Cents;
  occurredOn: ISODate;
  renewalDate: ISODate | null;
  voidsEntryId: string | null;
  concept: string | null;
  /** Renovaciones seguidas que cubre el pago (1 si no se indica). */
  periods?: number;
}

export interface PersonalSubscription {
  id: string;
  /** Lo que es de verdad (servicio y plan). Sirve también para el logotipo. */
  name: string;
  /** Nombre personalizado opcional; si existe, es el título que se muestra. */
  nickname: string | null;
  categoryId: CategoryId;
  currency: Currency;
  billingPeriod: BillingPeriod;
  renewalAnchor: ISODate;
  status: SubscriptionStatus;
  cancelledOn: ISODate | null;
  paidThroughDate: ISODate | null;
  manageUrl: string | null;
  notes: string | null;
  trackingFrom: ISODate;
  prices: PriceRow[];
  entries: LedgerRow[];
  mode: "personal" | "shared";
  planId: string | null;
  /** Plazas del grupo (titular incluido). Solo en compartidas. */
  maxMembers: number | null;
  /** Papel de quien mira: propietario de una personal, líder o miembro de un grupo. */
  role: "owner" | "leader" | "member";
  /** Participantes activos (con cuenta o invitados). 1 en una personal. */
  activeMembers: number;
  /**
   * "member": plan que paga otra persona (fuera de la app) y del que pagas una
   * parte fija. El precio guardado es el total; tu gasto es myShareCents.
   */
  participation: "owner" | "member";
  myShareCents: Cents | null;
  /** Quién paga el plan, si eres miembro. */
  planOwnerName: string | null;
}

/**
 * Parte de un importe que corresponde a quien mira. Reparto igualitario entre
 * los participantes activos: cada uno floor(total / n) y el líder asume los
 * céntimos sobrantes. En una personal, el importe completo.
 */
type ShareFields = Pick<PersonalSubscription, "mode" | "role" | "activeMembers"> &
  Partial<Pick<PersonalSubscription, "participation" | "myShareCents">>;

export function myShareOf(sub: ShareFields, total: Cents): Cents {
  if (sub.participation === "member" && sub.myShareCents !== null && sub.myShareCents !== undefined) return sub.myShareCents;
  if (sub.mode !== "shared" || sub.activeMembers <= 1) return total;
  const base = Math.floor(total / sub.activeMembers);
  return sub.role === "member" ? base : total - base * (sub.activeMembers - 1);
}

/** Quien paga al proveedor y anota los pagos: el propietario o el líder. */
export function paysProvider(sub: Pick<PersonalSubscription, "role">): boolean {
  return sub.role !== "member";
}

/**
 * Lo que se paga en cada renovación desde el punto de vista de quien mira:
 * el precio completo si paga al proveedor; su parte si es miembro.
 */
export function payableOn(sub: PersonalSubscription, date: ISODate): Cents {
  const total = priceOn(sub.prices, date);
  return paysProvider(sub) && sub.participation !== "member" ? total : myShareOf(sub, total);
}

/** Título que se muestra: el nombre personalizado o, si no hay, el del servicio. */
export function titleOf(sub: Pick<PersonalSubscription, "name" | "nickname">): string {
  return sub.nickname?.trim() || sub.name;
}

/** Cuenta en el gasto y tiene previsiones de renovación. */
export function isRunning(sub: Pick<PersonalSubscription, "status">): boolean {
  return sub.status === "active" || sub.status === "trial";
}

/** Precio vigente en una fecha: el último con entrada en vigor igual o anterior. */
export function priceOn(prices: readonly PriceRow[], date: ISODate): Cents {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  let current = sorted[0].amountCents;
  for (const price of sorted) {
    if (price.effectiveFrom <= date) current = price.amountCents;
  }
  return current;
}

export function latestPrice(prices: readonly PriceRow[]): PriceRow | null {
  if (prices.length === 0) return null;
  return [...prices].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

/** Pagos que cuentan: los registrados que nadie ha anulado. */
export function effectivePayments(entries: readonly LedgerRow[]): LedgerRow[] {
  const voided = new Set(entries.filter((entry) => entry.kind === "void").map((entry) => entry.voidsEntryId));
  return entries
    .filter((entry) => entry.kind === "personal_payment" && !voided.has(entry.id))
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : 0));
}

export function isVoided(entry: LedgerRow, entries: readonly LedgerRow[]): boolean {
  return entries.some((other) => other.kind === "void" && other.voidsEntryId === entry.id);
}

/** Coste mensual equivalente con el precio de hoy. Lo pausado o cancelado no cuenta. */
export function monthlyCost(sub: PersonalSubscription, today: ISODate): Cents {
  return isRunning(sub) ? monthlyEquivalent(myShareOf(sub, priceOn(sub.prices, today)), sub.billingPeriod) : 0;
}

export function annualCost(sub: PersonalSubscription, today: ISODate): Cents {
  return isRunning(sub) ? annualEquivalent(myShareOf(sub, priceOn(sub.prices, today)), sub.billingPeriod) : 0;
}

/** Próxima fecha del calendario igual o posterior a hoy (solo si sigue en marcha). */
export function nextRenewal(sub: PersonalSubscription, today: ISODate): ISODate | null {
  if (!isRunning(sub)) return null;
  return nextScheduleDate(sub.renewalAnchor, sub.billingPeriod, today);
}

export interface Forecast {
  subscriptionId: string;
  /** Título que se muestra (nombre personalizado o del servicio). */
  name: string;
  /** Nombre del servicio, para el logotipo. */
  serviceName: string;
  categoryId: CategoryId;
  currency: Currency;
  date: ISODate;
  amount: Cents;
  paid: boolean;
}

function paidRenewalDates(sub: PersonalSubscription): Set<ISODate> {
  return new Set(
    effectivePayments(sub.entries)
      .map((entry) => entry.renewalDate)
      .filter((date): date is ISODate => date !== null),
  );
}

/** Previsiones entre hoy y `until` (incluidos). Son fechas, no pagos. */
export function forecasts(sub: PersonalSubscription, today: ISODate, until: ISODate): Forecast[] {
  if (!isRunning(sub)) return [];
  const paid = paidRenewalDates(sub);
  return scheduleBetween(sub.renewalAnchor, sub.billingPeriod, today, until).map((date) => ({
    subscriptionId: sub.id,
    name: titleOf(sub),
    serviceName: sub.name,
    categoryId: sub.categoryId,
    currency: sub.currency,
    date,
    // El líder ve lo que pagará al proveedor; un miembro, su parte.
    amount: payableOn(sub, date),
    paid: paid.has(date),
  }));
}

/**
 * Renovaciones pasadas sin pago registrado, desde que se dio de alta en la app.
 * No son deudas: solo avisan de que falta anotar un pago.
 * - Cancelada: solo hasta la fecha de cancelación.
 * - Pausada: no se avisa (no se sabe desde cuándo está pausada).
 */
export function missingRenewals(sub: PersonalSubscription, today: ISODate): Forecast[] {
  // Los pagos al proveedor los anota quien lo paga; un miembro no tiene nada que anotar aquí.
  if (sub.status === "paused" || !paysProvider(sub)) return [];
  const from = sub.trackingFrom > sub.renewalAnchor ? sub.trackingFrom : sub.renewalAnchor;
  let to = addDays(today, -1);
  if (sub.status === "cancelled" && sub.cancelledOn) {
    const lastBeforeCancel = addDays(sub.cancelledOn, -1);
    if (lastBeforeCancel < to) to = lastBeforeCancel;
  }
  if (to < from) return [];
  const paid = paidRenewalDates(sub);
  return scheduleBetween(sub.renewalAnchor, sub.billingPeriod, from, to)
    .filter((date) => !paid.has(date))
    .map((date) => ({
      subscriptionId: sub.id,
      name: titleOf(sub),
      serviceName: sub.name,
      categoryId: sub.categoryId,
      currency: sub.currency,
      date,
      amount: payableOn(sub, date),
      paid: false,
    }));
}

export interface CurrencyTotal {
  currency: Currency;
  monthly: Cents;
  annual: Cents;
  count: number;
}

/** Totales por moneda: nunca se suman monedas distintas. Ordenado con la moneda preferida primero. */
export function totalsByCurrency(subs: readonly PersonalSubscription[], today: ISODate, preferred: Currency): CurrencyTotal[] {
  const map = new Map<Currency, CurrencyTotal>();
  for (const sub of subs) {
    if (!isRunning(sub)) continue;
    const row = map.get(sub.currency) ?? { currency: sub.currency, monthly: 0, annual: 0, count: 0 };
    row.monthly += monthlyCost(sub, today);
    row.annual += annualCost(sub, today);
    row.count += 1;
    map.set(sub.currency, row);
  }
  if (!map.has(preferred)) map.set(preferred, { currency: preferred, monthly: 0, annual: 0, count: 0 });
  return [...map.values()].sort((a, b) => (a.currency === preferred ? -1 : b.currency === preferred ? 1 : a.currency < b.currency ? -1 : 1));
}

export interface CategoryTotal {
  categoryId: CategoryId;
  amount: Cents;
  items: { id: string; name: string; amount: Cents }[];
}

/** Mensual equivalente por categoría, en una sola moneda. */
export function categoryTotals(subs: readonly PersonalSubscription[], today: ISODate, currency: Currency): CategoryTotal[] {
  const map = new Map<CategoryId, CategoryTotal>();
  for (const sub of subs) {
    if (!isRunning(sub) || sub.currency !== currency) continue;
    const amount = monthlyCost(sub, today);
    const row = map.get(sub.categoryId) ?? { categoryId: sub.categoryId, amount: 0, items: [] };
    row.amount += amount;
    row.items.push({ id: sub.id, name: titleOf(sub), amount });
    map.set(sub.categoryId, row);
  }
  for (const row of map.values()) row.items.sort((a, b) => b.amount - a.amount);
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export interface MonthPaid {
  month: string;
  start: ISODate;
  amount: Cents;
}

/** Pagos reales registrados por mes (últimos `months` meses hasta el de hoy), en una moneda. */
export function paidByMonth(
  subs: readonly PersonalSubscription[],
  today: ISODate,
  currency: Currency,
  months = 12,
): MonthPaid[] {
  const { year, month } = parseISODate(today);
  const currentStart = toISODate(year, month, 1);
  const rows: MonthPaid[] = Array.from({ length: months }, (_, index) => {
    const start = addMonths(currentStart, index - (months - 1));
    return { month: monthKey(start), start, amount: 0 };
  });
  const byKey = new Map(rows.map((row) => [row.month, row]));
  for (const sub of subs) {
    if (sub.currency !== currency) continue;
    for (const entry of effectivePayments(sub.entries)) {
      if (entry.occurredOn > today) continue;
      const row = byKey.get(monthKey(entry.occurredOn));
      if (row) row.amount += entry.amountCents;
    }
  }
  return rows;
}

export function totalPaid(entries: readonly LedgerRow[]): Cents {
  return sumCents(effectivePayments(entries).map((entry) => entry.amountCents));
}
