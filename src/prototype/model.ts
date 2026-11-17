/**
 * Cálculos del prototipo a partir de los datos ficticios de data.ts.
 * Todo total se deriva de las filas; las invariantes se comprueban al cargar
 * el módulo (si fallan, la página y el build fallan).
 */
import {
  CATEGORIES,
  ONDAS,
  PEOPLE,
  PERSONAL,
  PIXA,
  TODAY,
  type CategoryId,
  type GroupSpec,
  type Person,
  type PersonId,
} from "./data.ts";
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  formatDay,
  monthKey,
  nextScheduleDate,
  parseISODate,
  scheduleBetween,
  toISODate,
  type ISODate,
} from "../lib/finance/dates.ts";
import {
  annualEquivalent,
  monthlyEquivalent,
  percentOf,
  splitEqual,
  sumCents,
  type BillingPeriod,
  type Cents,
} from "../lib/finance/money.ts";
import {
  allocatePayments,
  allocatedTo,
  coveredThrough,
  installmentStatus,
  overdueSince,
  type Allocation,
  type Installment,
  type InstallmentStatus,
  type MemberPayment,
} from "../lib/finance/installments.ts";

export { TODAY };

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invariante del prototipo rota: ${message}`);
}

/* ------------------------------------------------------------------ */
/* Grupos                                                              */
/* ------------------------------------------------------------------ */

export interface ProviderPeriod {
  index: number;
  start: ISODate;
  end: ISODate;
  /** El periodo ya empezó: su reparto está fotografiado. */
  snapshot: boolean;
  current: boolean;
}

export interface InstallmentView extends Installment {
  firstPeriodIndex: number;
  allocated: Cents;
  status: InstallmentStatus;
  /** Importe declarado por el participante y pendiente de confirmar. */
  declared: Cents;
  /** Parte del coste ya fotografiado que este plazo cubre. */
  snapshotCost: Cents;
  fromCredit: Cents;
}

export interface MemberLedger {
  person: Person;
  role: "leader" | "member";
  agreement: { period: BillingPeriod; label: string } | null;
  share: Cents;
  installments: InstallmentView[];
  payments: (MemberPayment & { concept: string })[];
  allocations: Allocation[];
  credit: Cents;
  coveredThrough: ISODate | null;
  /** Coste atribuido de los periodos ya fotografiados. */
  costToDate: Cents;
  confirmedPaid: Cents;
  declaredPending: Cents;
  uncovered: Cents;
  overdue: Cents;
  /** Pagado por encima del coste atribuido hasta hoy (plazos futuros y saldo a favor). */
  prepaid: Cents;
  oldestOverdueSince: ISODate | null;
  nextInstallment: InstallmentView | null;
}

export interface GroupModel {
  spec: GroupSpec;
  periods: ProviderPeriod[];
  shares: Map<PersonId, Cents>;
  members: MemberLedger[];
  seats: { max: number; occupied: number; reserved: number; free: number; reservedUntil: ISODate | null };
  treasury: {
    paidProvider: Cents;
    collected: Cents;
    net: Cents;
    leaderShare: Cents;
    uncovered: Cents;
    uncoveredOverdue: Cents;
    uncoveredAwaiting: Cents;
    uncoveredNotDue: Cents;
    prepaid: Cents;
    unexplained: Cents;
  };
  leader: Person;
  snapshotCount: number;
  currentPeriod: ProviderPeriod;
}

function providerPeriods(spec: GroupSpec): ProviderPeriod[] {
  return Array.from({ length: spec.periodsShown }, (_, index) => {
    const start = addMonths(spec.anchor, index);
    const end = addMonths(spec.anchor, index + 1);
    return { index, start, end, snapshot: start <= TODAY, current: start <= TODAY && TODAY < end };
  });
}

/** Día de vencimiento dentro del periodo: el día `dueDay` en o después del inicio. */
function dueDateFor(periodStart: ISODate, dueDay: number): ISODate {
  const { year, month } = parseISODate(periodStart);
  const candidate = toISODate(year, month, Math.min(dueDay, daysInMonth(year, month)));
  if (candidate >= periodStart) return candidate;
  const next = addMonths(toISODate(year, month, 1), 1);
  const parsed = parseISODate(next);
  return toISODate(parsed.year, parsed.month, Math.min(dueDay, daysInMonth(parsed.year, parsed.month)));
}

function buildGroup(spec: GroupSpec): GroupModel {
  const periods = providerPeriods(spec);
  const ordered = spec.members.map((member) => member.person);
  const remainderIndex = ordered.indexOf(spec.remainderTo);
  const split = splitEqual(spec.price, ordered.length, remainderIndex);
  const shares = new Map<PersonId, Cents>(ordered.map((person, index) => [person, split[index]]));
  invariant(sumCents(split) === spec.price, `el reparto de ${spec.name} no suma el precio`);

  const snapshotCount = periods.filter((period) => period.snapshot).length;
  const currentPeriod = periods.find((period) => period.current);
  invariant(currentPeriod !== undefined, `${spec.name} no tiene periodo actual`);

  const members: MemberLedger[] = spec.members.map((memberSpec) => {
    const person = PEOPLE[memberSpec.person];
    const share = shares.get(memberSpec.person) ?? 0;
    const agreement = memberSpec.agreement;
    const installments: Installment[] = [];

    if (agreement?.period === "monthly") {
      for (const period of periods) {
        installments.push({
          id: `${person.id}-${period.index}`,
          memberId: person.id,
          amount: share,
          dueDate: dueDateFor(period.start, agreement.dueDay ?? 1),
          coversFrom: period.start,
          coversUntil: period.end,
          periodCount: 1,
          estimated: !period.snapshot,
        });
      }
    } else if (agreement?.period === "yearly") {
      for (let first = 0; first < periods.length; first += 12) {
        const covered = periods.slice(first, first + 12);
        installments.push({
          id: `${person.id}-${first}`,
          memberId: person.id,
          amount: share * covered.length,
          dueDate: first === 0 && agreement.yearlyDueDate ? agreement.yearlyDueDate : covered[0].start,
          coversFrom: covered[0].start,
          coversUntil: covered[covered.length - 1].end,
          periodCount: covered.length,
          estimated: covered.some((period) => !period.snapshot),
        });
      }
    }

    const targetFor = (periodIndex: number | undefined) => {
      if (periodIndex === undefined) return undefined;
      if (agreement?.period === "yearly") return `${person.id}-${Math.floor(periodIndex / 12) * 12}`;
      return `${person.id}-${periodIndex}`;
    };

    const payments = spec.memberPayments
      .filter((payment) => payment.person === memberSpec.person)
      .map((payment) => ({
        id: payment.id,
        memberId: person.id,
        amount: payment.amount,
        occurredOn: payment.occurredOn,
        status: payment.status,
        targetInstallmentId: targetFor(payment.forPeriodIndex),
        concept: payment.concept,
      }));

    const { allocations, credit } = allocatePayments(installments, payments, TODAY);

    const views: InstallmentView[] = installments.map((installment) => {
      const allocated = allocatedTo(installment.id, allocations);
      const coveredPeriods = periods.filter(
        (period) => period.start >= installment.coversFrom && period.end <= installment.coversUntil,
      );
      return {
        ...installment,
        firstPeriodIndex: coveredPeriods[0]?.index ?? 0,
        allocated,
        status: installmentStatus(installment, allocated, TODAY, spec.graceDays),
        declared: sumCents(
          payments
            .filter((payment) => payment.status === "declared" && payment.targetInstallmentId === installment.id)
            .map((payment) => payment.amount),
        ),
        snapshotCost: share * coveredPeriods.filter((period) => period.snapshot).length,
        fromCredit: sumCents(
          allocations
            .filter((allocation) => allocation.installmentId === installment.id && allocation.origin === "credit")
            .map((allocation) => allocation.amount),
        ),
      };
    });

    const confirmedPaid = sumCents(payments.filter((p) => p.status === "confirmed").map((p) => p.amount));
    const declaredPending = sumCents(payments.filter((p) => p.status === "declared").map((p) => p.amount));
    const costToDate = share * snapshotCount;
    const coveredToDate = sumCents(views.map((view) => Math.min(view.allocated, view.snapshotCost)));
    const overdueViews = views.filter((view) => view.status === "overdue");
    const isLeader = memberSpec.role === "leader";

    return {
      person,
      role: memberSpec.role,
      agreement: agreement
        ? {
            period: agreement.period,
            label:
              agreement.period === "monthly"
                ? `Mensual · vence el día ${agreement.dueDay}`
                : "Anual · un plazo por año",
          }
        : null,
      share,
      installments: views,
      payments,
      allocations,
      credit,
      coveredThrough: isLeader ? null : coveredThrough(installments, allocations),
      costToDate,
      confirmedPaid,
      declaredPending,
      uncovered: isLeader ? 0 : costToDate - coveredToDate,
      overdue: sumCents(overdueViews.map((view) => view.amount - view.allocated)),
      prepaid: isLeader ? 0 : confirmedPaid - coveredToDate,
      oldestOverdueSince: overdueViews.length > 0 ? overdueSince(overdueViews[0], spec.graceDays) : null,
      nextInstallment: views.find((view) => view.status !== "paid" && view.dueDate >= TODAY) ?? null,
    };
  });

  const others = members.filter((member) => member.role !== "leader");
  const leaderLedger = members.find((member) => member.role === "leader");
  invariant(leaderLedger !== undefined, `${spec.name} no tiene líder`);

  let uncoveredOverdue = 0;
  let uncoveredAwaiting = 0;
  let uncoveredNotDue = 0;
  for (const member of others) {
    for (const view of member.installments) {
      const gap = view.snapshotCost - Math.min(view.allocated, view.snapshotCost);
      if (gap === 0) continue;
      if (view.status === "overdue") uncoveredOverdue += gap;
      else if (view.declared > 0) uncoveredAwaiting += gap;
      else uncoveredNotDue += gap;
    }
  }

  const paidProvider = sumCents(spec.providerPayments.map((payment) => payment.amount));
  const collected = sumCents(others.map((member) => member.confirmedPaid));
  const net = paidProvider - collected;
  const leaderShare = leaderLedger.costToDate;
  const uncovered = sumCents(others.map((member) => member.uncovered));
  const prepaid = sumCents(others.map((member) => member.prepaid));
  const unexplained = net - (leaderShare + uncovered - prepaid);

  invariant(uncovered === uncoveredOverdue + uncoveredAwaiting + uncoveredNotDue, "desglose de lo no cubierto");
  invariant(unexplained === 0, `tesorería de ${spec.name}: diferencia sin explicar de ${unexplained}`);

  const reservedInvites = spec.invitations.filter((invite) => invite.reservesSeatUntil >= TODAY);
  const occupied = members.length;
  const seats = {
    max: spec.maxSeats,
    occupied,
    reserved: reservedInvites.length,
    free: spec.maxSeats - occupied - reservedInvites.length,
    reservedUntil: reservedInvites[0]?.reservesSeatUntil ?? null,
  };
  invariant(seats.free >= 0, `${spec.name} supera su capacidad`);

  return {
    spec,
    periods,
    shares,
    members,
    seats,
    treasury: {
      paidProvider,
      collected,
      net,
      leaderShare,
      uncovered,
      uncoveredOverdue,
      uncoveredAwaiting,
      uncoveredNotDue,
      prepaid,
      unexplained,
    },
    leader: leaderLedger.person,
    snapshotCount,
    currentPeriod,
  };
}

export const ondas = buildGroup(ONDAS);
export const pixa = buildGroup(PIXA);

export interface GroupMovement {
  id: string;
  date: ISODate;
  kind: "provider" | "member";
  person: Person;
  amount: Cents;
  status: "declared" | "confirmed" | "rejected" | "voided";
  concept: string;
}

/** Movimientos del grupo. Solo para el líder. */
export function leaderMovements(group: GroupModel): GroupMovement[] {
  const provider: GroupMovement[] = group.spec.providerPayments.map((payment) => ({
    id: payment.id,
    date: payment.occurredOn,
    kind: "provider",
    person: group.leader,
    amount: payment.amount,
    status: "confirmed",
    concept: "Pago al proveedor",
  }));
  const fromMembers: GroupMovement[] = group.members.flatMap((member) =>
    member.payments.map((payment) => ({
      id: payment.id,
      date: payment.occurredOn,
      kind: "member" as const,
      person: member.person,
      amount: payment.amount,
      status: payment.status,
      concept: payment.concept,
    })),
  );
  return [...provider, ...fromMembers].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

/**
 * Lo que puede ver un miembro de su grupo. No incluye importes, plazos,
 * cobertura ni movimientos de otros participantes.
 */
export interface MemberGroupView {
  name: string;
  plan: string;
  category: CategoryId;
  price: Cents;
  period: BillingPeriod;
  conditions: string;
  splitRule: string;
  graceDays: number;
  leader: Pick<Person, "name" | "initials" | "hue">;
  roster: { initials: string; name: string; hue: Person["hue"]; isYou: boolean; isLeader: boolean; hasAccount: boolean }[];
  seats: GroupModel["seats"];
  periods: ProviderPeriod[];
  me: MemberLedger;
}

export function memberView(group: GroupModel, personId: PersonId): MemberGroupView {
  const me = group.members.find((member) => member.person.id === personId);
  invariant(me !== undefined, `${personId} no participa en ${group.spec.name}`);
  return {
    name: group.spec.name,
    plan: group.spec.plan,
    category: group.spec.category,
    price: group.spec.price,
    period: group.spec.period,
    conditions: group.spec.conditions,
    splitRule: `Igualitario entre ${group.members.length} participantes`,
    graceDays: group.spec.graceDays,
    leader: { name: group.leader.name, initials: group.leader.initials, hue: group.leader.hue },
    roster: group.members.map((member) => ({
      initials: member.person.initials,
      name: member.person.name,
      hue: member.person.hue,
      isYou: member.person.id === personId,
      isLeader: member.role === "leader",
      hasAccount: member.person.hasAccount,
    })),
    seats: group.seats,
    periods: group.periods,
    me,
  };
}

/* ------------------------------------------------------------------ */
/* Resumen de Ana                                                      */
/* ------------------------------------------------------------------ */

export type Kind = "personal" | "shared";
export type Role = "holder" | "leader" | "member";

export interface SubscriptionItem {
  id: string;
  name: string;
  plan: string;
  kind: Kind;
  role: Role;
  category: CategoryId;
  period: BillingPeriod;
  /** Lo que me corresponde por periodo (contrato completo si es personal). */
  myAmount: Cents;
  fullAmount: Cents;
  myMonthly: Cents;
  fullMonthly: Cents;
  myAnnual: Cents;
  fullAnnual: Cents;
  nextDate: ISODate;
  nextLabel: string;
  href: string | null;
}

const viewerId: PersonId = "ana";

function itemsForAna(): SubscriptionItem[] {
  const personal: SubscriptionItem[] = PERSONAL.map((sub) => ({
    id: sub.id,
    name: sub.name,
    plan: sub.plan,
    kind: "personal",
    role: "holder",
    category: sub.category,
    period: sub.period,
    myAmount: sub.amount,
    fullAmount: sub.amount,
    myMonthly: monthlyEquivalent(sub.amount, sub.period),
    fullMonthly: monthlyEquivalent(sub.amount, sub.period),
    myAnnual: annualEquivalent(sub.amount, sub.period),
    fullAnnual: annualEquivalent(sub.amount, sub.period),
    nextDate: nextScheduleDate(sub.anchor, sub.period, TODAY),
    nextLabel: sub.period === "yearly" ? "Renovación anual prevista" : "Renovación prevista",
    href: null,
  }));

  const shared: SubscriptionItem[] = [
    { group: ondas, role: "leader" as const, href: "/prototipo/grupos/ondas" },
    { group: pixa, role: "member" as const, href: null },
  ].map(({ group, role, href }) => {
    const myShare = group.shares.get(viewerId) ?? 0;
    const next = group.periods.find((period) => period.start > TODAY);
    return {
      id: group.spec.id,
      name: group.spec.name,
      plan: group.spec.plan,
      kind: "shared" as const,
      role,
      category: group.spec.category,
      period: group.spec.period,
      myAmount: myShare,
      fullAmount: group.spec.price,
      myMonthly: monthlyEquivalent(myShare, group.spec.period),
      fullMonthly: monthlyEquivalent(group.spec.price, group.spec.period),
      myAnnual: annualEquivalent(myShare, group.spec.period),
      fullAnnual: annualEquivalent(group.spec.price, group.spec.period),
      nextDate: next?.start ?? TODAY,
      nextLabel: role === "leader" ? "Pago al proveedor previsto" : "Tu plazo",
      href,
    };
  });

  return [...personal, ...shared];
}

export const anaItems = itemsForAna();

export type KindFilter = "todas" | "personal" | "compartida";

export function filterItems(items: readonly SubscriptionItem[], kind: KindFilter): SubscriptionItem[] {
  if (kind === "todas") return [...items];
  return items.filter((item) => (kind === "personal" ? item.kind === "personal" : item.kind === "shared"));
}

export interface CashEntry {
  id: string;
  date: ISODate;
  direction: "out" | "in";
  amount: Cents;
  kind: Kind;
  subscriptionId: string;
  label: string;
}

/** Movimientos reales de Ana: lo que salió de su bolsillo y los reembolsos que recibió. */
export function anaCashEntries(): CashEntry[] {
  const entries: CashEntry[] = [];
  for (const sub of PERSONAL) {
    for (const payment of sub.payments) {
      entries.push({
        id: payment.id,
        date: payment.occurredOn,
        direction: "out",
        amount: payment.amount,
        kind: "personal",
        subscriptionId: sub.id,
        label: sub.name,
      });
    }
  }
  for (const payment of ONDAS.providerPayments) {
    entries.push({
      id: payment.id,
      date: payment.occurredOn,
      direction: "out",
      amount: payment.amount,
      kind: "shared",
      subscriptionId: "ondas",
      label: "Ondas Familiar · pago al proveedor",
    });
  }
  for (const member of ondas.members) {
    if (member.role === "leader") continue;
    for (const payment of member.payments) {
      if (payment.status !== "confirmed") continue;
      entries.push({
        id: payment.id,
        date: payment.occurredOn,
        direction: "in",
        amount: payment.amount,
        kind: "shared",
        subscriptionId: "ondas",
        label: `Reembolso de ${member.person.name}`,
      });
    }
  }
  const anaInPixa = pixa.members.find((member) => member.person.id === viewerId);
  for (const payment of anaInPixa?.payments ?? []) {
    if (payment.status !== "confirmed") continue;
    entries.push({
      id: payment.id,
      date: payment.occurredOn,
      direction: "out",
      amount: payment.amount,
      kind: "shared",
      subscriptionId: "pixa",
      label: "Pixa Juegos Familiar · tu plazo",
    });
  }
  return entries;
}

export interface MonthCash {
  month: string;
  start: ISODate;
  out: Cents;
  in: Cents;
  net: Cents;
}

export function monthlyCash(entries: readonly CashEntry[], kind: KindFilter, months = 12): MonthCash[] {
  const filtered = entries.filter((entry) =>
    kind === "todas" ? true : kind === "personal" ? entry.kind === "personal" : entry.kind === "shared",
  );
  const { year, month } = parseISODate(TODAY);
  const currentStart = toISODate(year, month, 1);
  return Array.from({ length: months }, (_, offset) => {
    const start = addMonths(currentStart, offset - (months - 1));
    const key = monthKey(start);
    const inMonth = filtered.filter((entry) => monthKey(entry.date) === key && entry.date <= TODAY);
    const out = sumCents(inMonth.filter((entry) => entry.direction === "out").map((entry) => entry.amount));
    const incoming = sumCents(inMonth.filter((entry) => entry.direction === "in").map((entry) => entry.amount));
    return { month: key, start, out, in: incoming, net: out - incoming };
  });
}

export interface UpcomingRow {
  id: string;
  date: ISODate;
  name: string;
  category: CategoryId;
  label: string;
  amount: Cents;
  /** Mi parte, cuando el importe es el completo. */
  myPart: Cents | null;
  kind: Kind;
  href: string | null;
}

export function anaUpcoming(kind: KindFilter, horizonDays = 45): UpcomingRow[] {
  const until = addDays(TODAY, horizonDays);
  const rows: UpcomingRow[] = [];
  for (const sub of PERSONAL) {
    for (const date of scheduleBetween(sub.anchor, sub.period, TODAY, until)) {
      rows.push({
        id: `${sub.id}-${date}`,
        date,
        name: sub.name,
        category: sub.category,
        label: "Renovación prevista",
        amount: sub.amount,
        myPart: null,
        kind: "personal",
        href: null,
      });
    }
  }
  for (const period of ondas.periods) {
    if (period.start > TODAY && period.start <= until) {
      rows.push({
        id: `ondas-${period.start}`,
        date: period.start,
        name: ONDAS.name,
        category: ONDAS.category,
        label: "Pago al proveedor previsto",
        amount: ONDAS.price,
        myPart: ondas.shares.get(viewerId) ?? 0,
        kind: "shared",
        href: "/prototipo/grupos/ondas",
      });
    }
  }
  const anaInPixa = pixa.members.find((member) => member.person.id === viewerId);
  for (const installment of anaInPixa?.installments ?? []) {
    if (installment.status !== "paid" && installment.dueDate >= TODAY && installment.dueDate <= until) {
      rows.push({
        id: installment.id,
        date: installment.dueDate,
        name: PIXA.name,
        category: PIXA.category,
        label: `Tu plazo · a ${pixa.leader.name.split(" ")[0]}`,
        amount: installment.amount,
        myPart: null,
        kind: "shared",
        href: null,
      });
    }
  }
  return rows
    .filter((row) => (kind === "todas" ? true : kind === "personal" ? row.kind === "personal" : row.kind === "shared"))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)));
}

/** Renovaciones pasadas del calendario sin ningún pago registrado (aviso, no deuda). */
export interface MissingRenewal {
  id: string;
  name: string;
  category: CategoryId;
  date: ISODate;
  amount: Cents;
}

export function anaMissingRenewals(): MissingRenewal[] {
  const missing: MissingRenewal[] = [];
  for (const sub of PERSONAL) {
    const recorded = new Set(sub.payments.map((payment) => payment.renewalDate));
    for (const date of scheduleBetween(sub.anchor, sub.period, sub.trackedFrom, addDays(TODAY, -1))) {
      if (!recorded.has(date)) {
        missing.push({ id: `${sub.id}-${date}`, name: sub.name, category: sub.category, date, amount: sub.amount });
      }
    }
  }
  return missing;
}

export interface Receivable {
  person: Person;
  amount: Cents;
  state: "overdue" | "awaiting" | "notDue";
  detail: string;
  daysOverdue: number | null;
}

/** Lo que le deben a Ana en los grupos que lidera, por persona. */
export function anaReceivables(): Receivable[] {
  const rows: Receivable[] = [];
  for (const member of ondas.members) {
    if (member.role === "leader" || member.uncovered === 0) continue;
    if (member.overdue > 0) {
      const count = member.installments.filter((view) => view.status === "overdue").length;
      rows.push({
        person: member.person,
        amount: member.uncovered,
        state: "overdue",
        detail: `${count} ${count === 1 ? "plazo vencido" : "plazos vencidos"}`,
        daysOverdue: member.oldestOverdueSince ? daysBetween(member.oldestOverdueSince, TODAY) : null,
      });
    } else if (member.declaredPending > 0) {
      rows.push({
        person: member.person,
        amount: member.uncovered,
        state: "awaiting",
        detail: "Pago declarado, por confirmar",
        daysOverdue: null,
      });
    } else {
      rows.push({
        person: member.person,
        amount: member.uncovered,
        state: "notDue",
        detail: member.nextInstallment
          ? `${member.nextInstallment.allocated > 0 ? "Pago parcial" : "Pendiente"} · vence el ${formatDay(member.nextInstallment.dueDate)}`
          : "Pendiente",
        daysOverdue: null,
      });
    }
  }
  const order = { overdue: 0, awaiting: 1, notDue: 2 } as const;
  return rows.sort((a, b) => order[a.state] - order[b.state] || b.amount - a.amount);
}

export function categoryTotals(
  items: readonly SubscriptionItem[],
  field: "myMonthly" | "fullMonthly",
): { category: CategoryId; name: string; amount: Cents; share: number | null; items: SubscriptionItem[] }[] {
  const total = sumCents(items.map((item) => item[field]));
  const ids = Object.keys(CATEGORIES) as CategoryId[];
  return ids
    .map((category) => {
      const inCategory = items.filter((item) => item.category === category);
      const amount = sumCents(inCategory.map((item) => item[field]));
      return { category, name: CATEGORIES[category].name, amount, share: percentOf(amount, total), items: inCategory };
    })
    .filter((row) => row.items.length > 0)
    .sort((a, b) => b.amount - a.amount);
}

export const BUDGET_MONTHLY: Cents = 4000;

/* Invariantes de compatibilidad entre pantallas. */
{
  const myMonthly = sumCents(anaItems.map((item) => item.myMonthly));
  const byCategory = sumCents(categoryTotals(anaItems, "myMonthly").map((row) => row.amount));
  invariant(myMonthly === byCategory, "el total por categoría no coincide con Mi parte");
  const lucia = memberView(ondas, "lucia").me;
  const luciaAsLeaderSees = ondas.members.find((member) => member.person.id === "lucia");
  invariant(lucia === luciaAsLeaderSees, "la vista de Lucía no sale de los mismos datos que la del líder");
  invariant(
    sumCents(anaReceivables().map((row) => row.amount)) === ondas.treasury.uncovered,
    "lo pendiente de cobro del resumen no coincide con la tesorería del grupo",
  );
}
