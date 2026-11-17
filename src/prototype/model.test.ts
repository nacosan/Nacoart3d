import { test } from "vitest";
import assert from "node:assert/strict";
import { sumCents } from "../lib/finance/money.ts";
import {
  anaCashEntries,
  anaItems,
  anaMissingRenewals,
  anaReceivables,
  filterItems,
  memberView,
  monthlyCash,
  ondas,
} from "./model.ts";

const member = (id: string) => {
  const found = ondas.members.find((item) => item.person.id === id);
  assert.ok(found);
  return found;
};

test("grupo de seis con plazas libres y reservadas", () => {
  assert.deepEqual(
    { max: ondas.seats.max, occupied: ondas.seats.occupied, reserved: ondas.seats.reserved, free: ondas.seats.free },
    { max: 8, occupied: 6, reserved: 1, free: 1 },
  );
  for (const share of ondas.shares.values()) assert.equal(share, 400);
});

test("tesorería del líder cuadra sin diferencias", () => {
  const t = ondas.treasury;
  assert.equal(t.paidProvider, 21600);
  assert.equal(t.collected, 19000);
  assert.equal(t.net, 2600);
  assert.equal(t.leaderShare, 3600);
  assert.equal(t.uncovered, 1400);
  assert.deepEqual([t.uncoveredOverdue, t.uncoveredAwaiting, t.uncoveredNotDue], [800, 400, 200]);
  assert.equal(t.prepaid, 2400);
  assert.equal(t.unexplained, 0);
});

test("casos de los participantes", () => {
  assert.equal(member("lucia").installments[8].status, "partial");
  assert.equal(member("lucia").coveredThrough, "2026-11-04");
  assert.equal(member("pablo").declaredPending, 400);
  assert.equal(member("pablo").installments[8].status, "pending");
  assert.equal(member("marta").overdue, 800);
  assert.equal(member("javier").installments.length, 1);
  assert.equal(member("javier").installments[0].status, "paid");
  assert.equal(member("javier").coveredThrough, "2027-03-04");
  assert.equal(member("carmen").credit, 1200);
  assert.equal(member("carmen").installments[7].fromCredit, 400);
});

test("la vista de miembro solo contiene datos propios", () => {
  const view = memberView(ondas, "lucia");
  const serialized = JSON.stringify(view);
  assert.equal(view.me.person.id, "lucia");
  for (const other of ["pab-", "mar-", "jav-", "car-", "prov-"]) {
    assert.ok(!serialized.includes(`"${other}`), `la vista de Lucía filtra movimientos ${other}`);
  }
  assert.ok(!serialized.includes("ejemplo.com"), "no expone invitaciones restringidas");
});

test("resumen de Ana sin doble conteo", () => {
  const mine = sumCents(anaItems.map((item) => item.myMonthly));
  const full = sumCents(anaItems.map((item) => item.fullMonthly));
  assert.equal(mine, 3131);
  assert.equal(full, 6331);
  assert.equal(sumCents(filterItems(anaItems, "personal").map((item) => item.myMonthly)), 2132);
  assert.equal(sumCents(filterItems(anaItems, "compartida").map((item) => item.myMonthly)), 999);
});

test("pagos reales: reembolsos restan, no son ingresos ni gastos nuevos", () => {
  const months = monthlyCash(anaCashEntries(), "todas");
  const november = months[months.length - 1];
  assert.equal(november.month, "2026-11");
  assert.deepEqual([november.out, november.in, november.net], [2400, 200, 2200]);
  const totalNet = sumCents(months.map((month) => month.net));
  const totalOut = sumCents(months.map((month) => month.out));
  const totalIn = sumCents(months.map((month) => month.in));
  assert.equal(totalNet, totalOut - totalIn);
});

test("renovación sin pago registrado y lo pendiente de cobro", () => {
  assert.deepEqual(
    anaMissingRenewals().map((row) => row.date),
    ["2026-09-24"],
  );
  assert.equal(sumCents(anaReceivables().map((row) => row.amount)), 1400);
});
