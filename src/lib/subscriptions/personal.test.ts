import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { centsToInput, parseAmountToCents } from "../finance/money.ts";
import {
  categoryTotals,
  effectivePayments,
  forecasts,
  missingRenewals,
  monthlyCost,
  myShareOf,
  nextRenewal,
  paidByMonth,
  priceOn,
  totalsByCurrency,
  type PersonalSubscription,
} from "./personal.ts";

function sub(overrides: Partial<PersonalSubscription> = {}): PersonalSubscription {
  return {
    id: "s1",
    name: "Servicio",
    nickname: null,
    categoryId: "video",
    currency: "EUR",
    billingPeriod: "monthly",
    renewalAnchor: "2026-01-31",
    status: "active",
    cancelledOn: null,
    paidThroughDate: null,
    manageUrl: null,
    notes: null,
    trackingFrom: "2026-01-01",
    prices: [{ amountCents: 1299, effectiveFrom: "2026-01-31" }],
    entries: [],
    mode: "personal",
    planId: null,
    maxMembers: null,
    role: "owner",
    activeMembers: 1,
    participation: "owner",
    myShareCents: null,
    planOwnerName: null,
    ...overrides,
  };
}

describe("importes escritos a mano", () => {
  test("acepta formato español e inglés y no usa coma flotante", () => {
    assert.equal(parseAmountToCents("12,99"), 1299);
    assert.equal(parseAmountToCents("12.99"), 1299);
    assert.equal(parseAmountToCents("1.234,5"), 123450);
    assert.equal(parseAmountToCents("7"), 700);
    assert.equal(parseAmountToCents("0,1"), 10);
    assert.equal(parseAmountToCents(" 9,99 € "), 999);
    assert.equal(parseAmountToCents("1.000"), 100000);
  });

  test("rechaza lo que no es un importe", () => {
    assert.equal(parseAmountToCents(""), null);
    assert.equal(parseAmountToCents("-5"), null);
    assert.equal(parseAmountToCents("1,999"), null);
    assert.equal(parseAmountToCents("abc"), null);
    assert.equal(parseAmountToCents("1,2,3"), null);
  });

  test("vuelta al campo de texto", () => {
    assert.equal(centsToInput(1299), "12,99");
    assert.equal(centsToInput(5), "0,05");
  });
});

describe("suscripciones personales", () => {
  test("equivalentes: un anual cuenta entre 12 al mes", () => {
    const yearly = sub({ billingPeriod: "yearly", prices: [{ amountCents: 9999, effectiveFrom: "2026-01-31" }] });
    assert.equal(monthlyCost(yearly, "2026-11-22"), 833);
    assert.equal(monthlyCost(sub(), "2026-11-22"), 1299);
  });

  test("pausada o cancelada no cuenta en el gasto ni tiene previsiones", () => {
    const paused = sub({ status: "paused" });
    assert.equal(monthlyCost(paused, "2026-11-22"), 0);
    assert.equal(nextRenewal(paused, "2026-11-22"), null);
    const cancelled = sub({ status: "cancelled", cancelledOn: "2026-06-10", paidThroughDate: "2026-06-30" });
    assert.equal(nextRenewal(cancelled, "2026-11-22"), null);
    assert.deepEqual(forecasts(cancelled, "2026-11-22", "2026-12-31"), []);
  });

  test("renovación a fin de mes: el ancla 31 ene da 30 nov y 31 dic", () => {
    assert.equal(nextRenewal(sub(), "2026-11-22"), "2026-11-30");
    assert.deepEqual(
      forecasts(sub(), "2026-11-22", "2027-01-01").map((row) => row.date),
      ["2026-11-30", "2026-12-31"],
    );
  });

  test("anual con ancla el 29 de febrero renueva el 28 los años no bisiestos", () => {
    const leap = sub({ billingPeriod: "yearly", renewalAnchor: "2024-02-29" });
    assert.equal(nextRenewal(leap, "2026-01-10"), "2026-02-28");
    assert.equal(nextRenewal(leap, "2027-03-01"), "2028-02-29");
  });

  test("el precio aplica desde su fecha y no reescribe el pasado", () => {
    const prices = [
      { amountCents: 1000, effectiveFrom: "2026-01-01" },
      { amountCents: 1200, effectiveFrom: "2026-06-01" },
    ];
    assert.equal(priceOn(prices, "2026-05-31"), 1000);
    assert.equal(priceOn(prices, "2026-06-01"), 1200);
  });

  test("renovaciones sin pago: desde el alta, sin las pagadas ni las anuladas", () => {
    const s = sub({
      renewalAnchor: "2026-08-15",
      trackingFrom: "2026-09-01",
      entries: [
        { id: "p1", kind: "personal_payment", amountCents: 1299, occurredOn: "2026-09-15", renewalDate: "2026-09-15", voidsEntryId: null, concept: null },
        { id: "p2", kind: "personal_payment", amountCents: 1299, occurredOn: "2026-10-15", renewalDate: "2026-10-15", voidsEntryId: null, concept: null },
        { id: "v2", kind: "void", amountCents: 1299, occurredOn: "2026-10-20", renewalDate: null, voidsEntryId: "p2", concept: null },
      ],
    });
    // 15 ago es anterior al alta; 15 sep está pagada; 15 oct se anuló; 15 nov falta.
    assert.deepEqual(
      missingRenewals(s, "2026-11-22").map((row) => row.date),
      ["2026-10-15", "2026-11-15"],
    );
    assert.deepEqual(missingRenewals(s, "2026-11-15").map((row) => row.date), ["2026-10-15"]);
  });

  test("las previsiones nunca se cuentan como pagos", () => {
    const s = sub({ renewalAnchor: "2026-11-01", trackingFrom: "2026-11-01" });
    assert.equal(forecasts(s, "2026-11-22", "2027-11-22").length, 12);
    assert.equal(effectivePayments(s.entries).length, 0);
    assert.equal(paidByMonth([s], "2026-11-22", "EUR").reduce((total, row) => total + row.amount, 0), 0);
  });

  test("totales separados por moneda y por categoría", () => {
    const subs = [
      sub({ id: "a" }),
      sub({ id: "b", categoryId: "musica", prices: [{ amountCents: 500, effectiveFrom: "2026-01-31" }] }),
      sub({ id: "c", currency: "USD", prices: [{ amountCents: 1000, effectiveFrom: "2026-01-31" }] }),
      sub({ id: "d", status: "paused" }),
    ];
    const totals = totalsByCurrency(subs, "2026-11-22", "EUR");
    assert.deepEqual(
      totals.map((row) => [row.currency, row.monthly, row.count]),
      [
        ["EUR", 1799, 2],
        ["USD", 1000, 1],
      ],
    );
    assert.deepEqual(
      categoryTotals(subs, "2026-11-22", "EUR").map((row) => [row.categoryId, row.amount]),
      [
        ["video", 1299],
        ["musica", 500],
      ],
    );
  });

  test("pagos por mes: solo los registrados y no anulados", () => {
    const s = sub({
      entries: [
        { id: "p1", kind: "personal_payment", amountCents: 1299, occurredOn: "2026-11-02", renewalDate: null, voidsEntryId: null, concept: null },
        { id: "p2", kind: "personal_payment", amountCents: 500, occurredOn: "2026-10-02", renewalDate: null, voidsEntryId: null, concept: null },
        { id: "v1", kind: "void", amountCents: 500, occurredOn: "2026-10-05", renewalDate: null, voidsEntryId: "p2", concept: null },
      ],
    });
    const months = paidByMonth([s], "2026-11-22", "EUR");
    assert.equal(months.length, 12);
    assert.equal(months[11].month, "2026-11");
    assert.equal(months[11].amount, 1299);
    assert.equal(months[10].amount, 0);
  });

  test("compartida: mi parte es el reparto igualitario y el líder asume los céntimos", () => {
    const family = { prices: [{ amountCents: 2099, effectiveFrom: "2026-01-31" }], mode: "shared" as const, maxMembers: 6, activeMembers: 3 };
    // 20,99 € entre 3: 6,99 + 6,99 + 7,01 (líder).
    assert.equal(monthlyCost(sub({ ...family, role: "member" }), "2026-11-22"), 699);
    assert.equal(monthlyCost(sub({ ...family, role: "leader" }), "2026-11-22"), 701);
    assert.equal(myShareOf({ mode: "shared", role: "member", activeMembers: 6 }, 2400), 400);
    // Las plazas vacías no se reparten: con 1 activo, el líder paga todo.
    assert.equal(myShareOf({ mode: "shared", role: "leader", activeMembers: 1 }, 2099), 2099);
  });

  test("compartida: el miembro no tiene pagos por anotar y ve su parte en las previsiones", () => {
    const member = sub({ mode: "shared", role: "member", activeMembers: 2, maxMembers: 2, prices: [{ amountCents: 1699, effectiveFrom: "2026-01-31" }] });
    assert.deepEqual(missingRenewals(member, "2026-11-22"), []);
    assert.equal(forecasts(member, "2026-11-22", "2026-12-01")[0].amount, 849);
    const leader = sub({ mode: "shared", role: "leader", activeMembers: 2, maxMembers: 2, prices: [{ amountCents: 1699, effectiveFrom: "2026-01-31" }] });
    assert.equal(forecasts(leader, "2026-11-22", "2026-12-01")[0].amount, 1699);
  });

  test("miembro de un plan que paga otra persona: cuenta su parte, no el total", () => {
    const member = sub({ participation: "member", myShareCents: 350, prices: [{ amountCents: 2099, effectiveFrom: "2026-01-31" }] });
    assert.equal(monthlyCost(member, "2026-11-22"), 350);
    assert.equal(forecasts(member, "2026-11-22", "2026-12-01")[0].amount, 350);
    assert.equal(missingRenewals(sub({ ...member, renewalAnchor: "2026-10-05", trackingFrom: "2026-10-01" }), "2026-11-22")[0].amount, 350);
  });
});
