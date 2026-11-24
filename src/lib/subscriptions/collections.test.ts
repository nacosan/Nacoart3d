import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { balanceOf, calendarSegments, monthIndex, installmentsFor, ownInstallments, shareOn, type MemberPaymentRow, type MembershipRow } from "./collections.ts";
import type { PersonalSubscription } from "./personal.ts";

const sub: PersonalSubscription = {
  id: "s",
  name: "Familiar",
  nickname: null,
  categoryId: "musica",
  currency: "EUR",
  billingPeriod: "monthly",
  renewalAnchor: "2026-08-05",
  status: "active",
  cancelledOn: null,
  paidThroughDate: null,
  manageUrl: null,
  notes: null,
  trackingFrom: "2026-08-05",
  prices: [{ amountCents: 2100, effectiveFrom: "2026-08-05" }],
  entries: [],
  mode: "shared",
  planId: null,
  maxMembers: 6,
  role: "leader",
  activeMembers: 3,
  participation: "owner",
  myShareCents: null,
  planOwnerName: null,
};

const leader: MembershipRow = { id: "L", role: "leader", joinedOn: "2026-08-05", leftOn: null };
const ana: MembershipRow = { id: "A", role: "member", joinedOn: "2026-08-05", leftOn: null };
// Entra el 20 de septiembre: debe desde la renovación del 5 de septiembre.
const bea: MembershipRow = { id: "B", role: "member", joinedOn: "2026-09-20", leftOn: null };
const members = [leader, ana, bea];

function pay(memberId: string, renewalDate: string, amountCents: number, status: MemberPaymentRow["status"] = "confirmed"): MemberPaymentRow {
  return { id: `${memberId}-${renewalDate}-${status}`, memberId, renewalDate, periods: 1, amountCents, paidOn: renewalDate, status, note: null };
}

describe("cobros del grupo", () => {
  test("el reparto de cada renovación usa a quienes estaban ese día", () => {
    // Agosto: líder + Ana → 10,50 cada uno.
    assert.equal(shareOn(sub, members, ana, "2026-08-05"), 1050);
    assert.equal(shareOn(sub, members, bea, "2026-08-05"), 0);
    // Septiembre: entra Bea en ese periodo → 7,00 cada uno.
    assert.equal(shareOn(sub, members, ana, "2026-09-05"), 700);
    assert.equal(shareOn(sub, members, bea, "2026-09-05"), 700);
  });

  test("estados: pagado, parcial, por confirmar, vencido, pendiente y próximo", () => {
    const payments = [
      pay("A", "2026-08-05", 1050),
      pay("A", "2026-09-05", 300),
      pay("A", "2026-10-05", 700, "declared"),
      pay("A", "2026-11-05", 700, "rejected"),
    ];
    const rows = installmentsFor(sub, members, ana, payments, "2026-11-23");
    assert.deepEqual(
      rows.map((row) => [row.date, row.status]),
      [
        ["2026-08-05", "paid"],
        ["2026-09-05", "partial"],
        ["2026-10-05", "awaiting"],
        ["2026-11-05", "overdue"],
        ["2026-12-05", "upcoming"],
      ],
    );
    const balance = balanceOf(rows, "2026-11-23");
    assert.equal(balance.overdue, 400 + 700);
    assert.equal(balance.awaiting, 700);
  });

  test("dentro del margen de 7 días está pendiente, no vencido", () => {
    const rows = installmentsFor(sub, members, ana, [], "2026-11-10");
    assert.equal(rows.find((row) => row.date === "2026-11-05")?.status, "pending");
  });

  test("el líder no tiene plazos y quien sale deja de deber", () => {
    assert.deepEqual(installmentsFor(sub, members, leader, [], "2026-11-23"), []);
    const left: MembershipRow = { ...ana, leftOn: "2026-10-01" };
    const rows = installmentsFor(sub, [leader, left, bea], left, [], "2026-11-23");
    assert.deepEqual(rows.map((row) => row.date), ["2026-08-05", "2026-09-05"]);
  });

  test("un pago anual cubre doce renovaciones y el calendario lo dibuja como un solo tramo", () => {
    // Ana paga el 5 de agosto un año entero (12 renovaciones de 10,50 €).
    const solo = [leader, ana];
    const year: MemberPaymentRow = { ...pay("A", "2026-08-05", 12600), periods: 12 };
    const rows = installmentsFor(sub, solo, ana, [year], "2026-11-23", "2027-12-31");
    assert.equal(rows.filter((row) => row.status === "paid").length, 12);
    assert.equal(rows.find((row) => row.date === "2027-08-05")?.status, "upcoming");
    const segments = calendarSegments(rows, monthIndex(2026, 1), 12, "monthly");
    // Agosto a diciembre de 2026: un tramo de 5 meses del pago anual.
    assert.deepEqual(
      segments.map((segment) => [segment.startCol, segment.span, segment.grouped]),
      [[8, 5, true]],
    );
    assert.equal(segments[0].through, "2027-08-04");
    assert.equal(segments[0].paidOn, "2026-08-05");
  });

  test("pagos mes a mes: un cuadrado por mes", () => {
    const solo = [leader, ana];
    const rows = installmentsFor(sub, solo, ana, [pay("A", "2026-08-05", 1050), pay("A", "2026-09-05", 1050)], "2026-11-23", "2026-12-31");
    const segments = calendarSegments(rows, monthIndex(2026, 1), 12, "monthly");
    assert.deepEqual(
      segments.map((segment) => [segment.startCol, segment.span, segment.status]),
      [
        [8, 1, "paid"],
        [9, 1, "paid"],
        [10, 1, "overdue"],
        [11, 1, "overdue"],
        [12, 1, "upcoming"],
      ],
    );
  });

  test("el rango puede cruzar de año: diciembre y los meses siguientes", () => {
    const solo = [leader, ana];
    const rows = installmentsFor(sub, solo, ana, [], "2026-11-23", "2027-03-31");
    // De noviembre de 2026 a marzo de 2027: columnas 1 (nov) a 5 (mar).
    const segments = calendarSegments(rows, monthIndex(2026, 11), 5, "monthly");
    assert.deepEqual(
      segments.map((segment) => [segment.startCol, segment.from]),
      [
        [1, "2026-11-05"],
        [2, "2026-12-05"],
        [3, "2027-01-05"],
        [4, "2027-02-05"],
        [5, "2027-03-05"],
      ],
    );
  });

  test("tus propios pagos (suscripción personal): el año pagado de golpe", () => {
    const own = {
      ...sub,
      mode: "personal" as const,
      role: "owner" as const,
      activeMembers: 1,
      trackingFrom: "2026-08-05",
      entries: [
        { id: "p1", kind: "personal_payment" as const, amountCents: 25200, occurredOn: "2026-08-05", renewalDate: "2026-08-05", voidsEntryId: null, concept: null, periods: 12 },
      ],
    };
    const rows = ownInstallments(own, "2026-11-23", "2026-12-31");
    assert.ok(rows.every((row) => row.status === "paid"));
    assert.deepEqual(calendarSegments(rows, monthIndex(2026, 1), 12, "monthly").map((segment) => [segment.startCol, segment.span]), [[8, 5]]);
  });
});
