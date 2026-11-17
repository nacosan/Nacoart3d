/**
 * DATOS FICTICIOS DEL PROTOTIPO (fase 1).
 *
 * Personas, servicios, planes, precios y condiciones son inventados.
 * Ningún plan describe un servicio real. Los totales no se escriben a mano:
 * se calculan en model.ts a partir de estas filas.
 */
import type { BillingPeriod, Cents } from "../lib/finance/money.ts";
import type { ISODate } from "../lib/finance/dates.ts";
import type { EntryStatus } from "../lib/finance/installments.ts";
import type { CategoryId, Hue } from "../lib/catalog.ts";

export { CATEGORIES } from "../lib/catalog.ts";
export type { CategoryId, Hue } from "../lib/catalog.ts";

/** Fecha fija del prototipo para que todas las pantallas cuadren. */
export const TODAY: ISODate = "2026-11-17";

export interface Person {
  id: string;
  name: string;
  initials: string;
  hue: Hue;
  hasAccount: boolean;
}

export const PEOPLE = {
  ana: { id: "ana", name: "Ana Ruiz", initials: "AR", hue: "azul", hasAccount: true },
  lucia: { id: "lucia", name: "Lucía Martín", initials: "LM", hue: "verde", hasAccount: true },
  pablo: { id: "pablo", name: "Pablo Gil", initials: "PG", hue: "ambar", hasAccount: true },
  marta: { id: "marta", name: "Marta Soler", initials: "MS", hue: "rosa", hasAccount: true },
  javier: { id: "javier", name: "Javier León", initials: "JL", hue: "oliva", hasAccount: true },
  carmen: { id: "carmen", name: "Carmen Ruiz", initials: "CR", hue: "turquesa", hasAccount: false },
  diego: { id: "diego", name: "Diego Paredes", initials: "DP", hue: "lila", hasAccount: true },
  sofia: { id: "sofia", name: "Sofía Paredes", initials: "SP", hue: "verde", hasAccount: true },
} satisfies Record<string, Person>;

export type PersonId = keyof typeof PEOPLE;

export interface PersonalSubscription {
  id: string;
  name: string;
  /** Plan ficticio. */
  plan: string;
  category: CategoryId;
  amount: Cents;
  period: BillingPeriod;
  /** Ancla del calendario de renovaciones. */
  anchor: ISODate;
  /** Desde cuándo se registran pagos en la app (antes no se marca nada como "sin pago"). */
  trackedFrom: ISODate;
  autoRenew: boolean;
  status: "active" | "trial" | "paused" | "cancelled";
  /** Pagos reales registrados por la titular. */
  payments: { id: string; renewalDate: ISODate; occurredOn: ISODate; amount: Cents }[];
}

const cinemarPayments = [
  "2025-12-24",
  "2026-01-24",
  "2026-02-24",
  "2026-03-24",
  "2026-04-24",
  "2026-05-24",
  "2026-06-24",
  "2026-07-24",
  "2026-08-24",
  // 2026-09-24: renovación sin pago registrado (a propósito, para el prototipo).
  "2026-10-24",
].map((date, index) => ({ id: `cin-${index + 1}`, renewalDate: date, occurredOn: date, amount: 1299 }));

export const PERSONAL: PersonalSubscription[] = [
  {
    id: "nubo",
    name: "Nubo 2 TB",
    plan: "Anual 2 TB (plan ficticio)",
    category: "almacenamiento",
    amount: 9999,
    period: "yearly",
    anchor: "2024-03-04",
    trackedFrom: "2025-03-04",
    autoRenew: true,
    status: "active",
    payments: [
      { id: "nub-1", renewalDate: "2025-03-04", occurredOn: "2025-03-04", amount: 9999 },
      { id: "nub-2", renewalDate: "2026-03-04", occurredOn: "2026-03-04", amount: 9999 },
    ],
  },
  {
    id: "cinemar",
    name: "Cinemar Estándar",
    plan: "Estándar mensual (plan ficticio)",
    category: "video",
    amount: 1299,
    period: "monthly",
    anchor: "2025-01-24",
    trackedFrom: "2025-12-24",
    autoRenew: true,
    status: "active",
    payments: cinemarPayments,
  },
];

export interface AgreementSpec {
  period: BillingPeriod;
  /** Día del mes de vencimiento (mensual) o fecha del plazo anual. */
  dueDay?: number;
  yearlyDueDate?: ISODate;
}

export interface GroupMemberSpec {
  person: PersonId;
  role: "leader" | "member";
  joinedOn: ISODate;
  /** El líder no tiene acuerdo: su parte la cubre pagando al proveedor. */
  agreement?: AgreementSpec;
}

export interface MemberPaymentSpec {
  id: string;
  person: PersonId;
  amount: Cents;
  occurredOn: ISODate;
  status: EntryStatus;
  /** Índice del periodo del plazo al que se aplicó (0 = primer periodo). Sin índice: sin destino. */
  forPeriodIndex?: number;
  concept: string;
}

export interface GroupSpec {
  id: string;
  name: string;
  plan: string;
  category: CategoryId;
  price: Cents;
  period: BillingPeriod;
  anchor: ISODate;
  maxSeats: number;
  holderCountsInLimit: boolean;
  conditions: string;
  graceDays: number;
  remainderTo: PersonId;
  members: GroupMemberSpec[];
  invitations: { id: string; reservesSeatUntil: ISODate; restrictedTo: string | null }[];
  memberPayments: MemberPaymentSpec[];
  /** Pagos al proveedor registrados por el líder. */
  providerPayments: { id: string; amount: Cents; occurredOn: ISODate; periodIndex: number }[];
  /** Periodos mostrados en la tira de cobertura. */
  periodsShown: number;
}

function monthly(person: PersonId, day: number, from: number, to: number, amount: Cents, prefix: string): MemberPaymentSpec[] {
  const list: MemberPaymentSpec[] = [];
  for (let index = from; index <= to; index += 1) {
    const month = 3 + index; // el grupo empieza en marzo de 2026
    list.push({
      id: `${prefix}-${index + 1}`,
      person,
      amount,
      occurredOn: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      status: "confirmed",
      forPeriodIndex: index,
      concept: "Bizum",
    });
  }
  return list;
}

export const ONDAS: GroupSpec = {
  id: "ondas",
  name: "Ondas Familiar",
  plan: "Familiar (plan ficticio)",
  category: "musica",
  price: 2400,
  period: "monthly",
  anchor: "2026-03-05",
  maxSeats: 8,
  holderCountsInLimit: true,
  conditions:
    "Plan ficticio para el prototipo: hasta 8 cuentas, titular incluido. Condición de ejemplo: los miembros deben compartir hogar. No describe ningún servicio real.",
  graceDays: 7,
  remainderTo: "ana",
  periodsShown: 12,
  members: [
    { person: "ana", role: "leader", joinedOn: "2026-03-05" },
    { person: "lucia", role: "member", joinedOn: "2026-03-05", agreement: { period: "monthly", dueDay: 20 } },
    { person: "pablo", role: "member", joinedOn: "2026-03-05", agreement: { period: "monthly", dueDay: 15 } },
    { person: "marta", role: "member", joinedOn: "2026-03-05", agreement: { period: "monthly", dueDay: 5 } },
    { person: "javier", role: "member", joinedOn: "2026-03-05", agreement: { period: "yearly", yearlyDueDate: "2026-03-05" } },
    { person: "carmen", role: "member", joinedOn: "2026-03-05", agreement: { period: "monthly", dueDay: 5 } },
  ],
  invitations: [{ id: "inv-1", reservesSeatUntil: "2026-11-24", restrictedTo: "s•••@ejemplo.com" }],
  memberPayments: [
    // Lucía: mensual, vence el día 20. Paga de marzo a octubre y 2,00 € de noviembre (pago parcial).
    ...monthly("lucia", 18, 0, 7, 400, "luc"),
    { id: "luc-9", person: "lucia", amount: 200, occurredOn: "2026-11-10", status: "confirmed", forPeriodIndex: 8, concept: "Bizum (parcial)" },
    // Pablo: mensual, vence el día 15. Noviembre declarado, pendiente de confirmar.
    ...monthly("pablo", 14, 0, 7, 400, "pab"),
    { id: "pab-9", person: "pablo", amount: 400, occurredOn: "2026-11-14", status: "declared", forPeriodIndex: 8, concept: "Transferencia" },
    // Marta: mensual, vence el día 5. Octubre y noviembre sin pagar (deuda vencida).
    ...monthly("marta", 5, 0, 6, 400, "mar"),
    // Javier: acuerdo anual. Un solo plazo de 48,00 € que cubre de marzo de 2026 a febrero de 2027.
    { id: "jav-1", person: "javier", amount: 4800, occurredOn: "2026-03-02", status: "confirmed", forPeriodIndex: 0, concept: "Transferencia anual" },
    // Carmen (invitada sin cuenta): paga en efectivo y adelanta 20,00 € el 1 de octubre (saldo a favor).
    ...monthly("carmen", 5, 0, 6, 400, "car").map((payment) => ({ ...payment, concept: "Efectivo" })),
    { id: "car-8", person: "carmen", amount: 2000, occurredOn: "2026-10-01", status: "confirmed", concept: "Efectivo (anticipo)" },
  ],
  providerPayments: Array.from({ length: 9 }, (_, index) => ({
    id: `prov-${index + 1}`,
    amount: 2400,
    occurredOn: `2026-${String(3 + index).padStart(2, "0")}-05`,
    periodIndex: index,
  })),
};

/** Grupo en el que Ana es miembro (líder: Diego). Solo se usa para el resumen de Ana. */
export const PIXA: GroupSpec = {
  id: "pixa",
  name: "Pixa Juegos Familiar",
  plan: "Familiar (plan ficticio)",
  category: "juegos",
  price: 1799,
  period: "monthly",
  anchor: "2026-06-25",
  maxSeats: 4,
  holderCountsInLimit: true,
  conditions: "Plan ficticio para el prototipo. No describe ningún servicio real.",
  graceDays: 7,
  remainderTo: "diego",
  periodsShown: 8,
  members: [
    { person: "diego", role: "leader", joinedOn: "2026-06-25" },
    { person: "ana", role: "member", joinedOn: "2026-06-25", agreement: { period: "monthly", dueDay: 25 } },
    { person: "sofia", role: "member", joinedOn: "2026-06-25", agreement: { period: "monthly", dueDay: 25 } },
  ],
  invitations: [],
  memberPayments: [0, 1, 2, 3, 4].flatMap((index) => [
    {
      id: `pix-ana-${index + 1}`,
      person: "ana" as const,
      amount: 599,
      occurredOn: `2026-${String(6 + index).padStart(2, "0")}-25`,
      status: "confirmed" as const,
      forPeriodIndex: index,
      concept: "Bizum",
    },
    {
      id: `pix-sof-${index + 1}`,
      person: "sofia" as const,
      amount: 599,
      occurredOn: `2026-${String(6 + index).padStart(2, "0")}-25`,
      status: "confirmed" as const,
      forPeriodIndex: index,
      concept: "Bizum",
    },
  ]),
  providerPayments: [0, 1, 2, 3, 4].map((index) => ({
    id: `pix-prov-${index + 1}`,
    amount: 1799,
    occurredOn: `2026-${String(6 + index).padStart(2, "0")}-25`,
    periodIndex: index,
  })),
};

/** Persona que usa la app en cada pantalla del prototipo. */
export const VIEWERS = { leader: "ana", member: "lucia" } as const satisfies Record<string, PersonId>;
