import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { balanceOf, installmentsFor, shareOn, type MemberPaymentRow, type MembershipRow } from "./collections.ts";
import type { PersonalSubscription } from "./personal.ts";

const sub: PersonalSubscription = {
  id: "s",
  name: "Familiar",
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
  return { id: `${memberId}-${renewalDate}-${status}`, memberId, renewalDate, amountCents, paidOn: renewalDate, status, note: null };
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
});
