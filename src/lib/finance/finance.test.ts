import { describe, test } from "vitest";
import assert from "node:assert/strict";
import {
  annualEquivalent,
  formatMoney,
  formatPercent,
  monthlyEquivalent,
  percentOf,
  splitEqual,
  splitFixed,
  sumCents,
} from "./money.ts";
import { addDays, addMonths, addYears, daysBetween, formatDay, nextScheduleDate, scheduleBetween } from "./dates.ts";
import { allocatePayments, allocatedTo, coveredThrough, installmentStatus } from "./installments.ts";
import type { Installment, MemberPayment } from "./installments.ts";

const nbsp = (value: string) => value.replace(/ /g, " ");

describe("dinero", () => {
  test("plan de 24 € entre seis participantes: 4 € cada uno", () => {
    assert.deepEqual(splitEqual(2400, 6), [400, 400, 400, 400, 400, 400]);
  });

  test("los céntimos sobrantes van al participante elegido y la suma cuadra", () => {
    const shares = splitEqual(1000, 3, 2);
    assert.deepEqual(shares, [333, 333, 334]);
    assert.equal(sumCents(shares), 1000);
    assert.deepEqual(splitEqual(1799, 3, 0), [601, 599, 599]);
  });

  test("con plazas libres se divide entre participantes reales, no por la capacidad", () => {
    // Plan de 8 plazas con 6 participantes: 24 € / 6, no 24 € / 8.
    assert.equal(splitEqual(2400, 6)[0], 400);
    assert.notEqual(splitEqual(2400, 6)[0], 2400 / 8);
  });

  test("cuotas fijas: el titular asume el resto; si no alcanza, se rechaza", () => {
    assert.deepEqual(splitFixed(2400, [500, 500, 300]), { holderShare: 1100 });
    assert.equal(splitFixed(1000, [600, 600]), null);
  });

  test("equivalentes mensual y anual", () => {
    assert.equal(monthlyEquivalent(1299, "monthly"), 1299);
    assert.equal(monthlyEquivalent(9999, "yearly"), 833);
    assert.equal(annualEquivalent(1299, "monthly"), 15588);
    assert.equal(annualEquivalent(9999, "yearly"), 9999);
  });

  test("porcentaje con denominador cero no es un número inválido", () => {
    assert.equal(percentOf(0, 0), null);
    assert.equal(formatPercent(null), "—");
    assert.equal(formatPercent(percentOf(400, 3131)), "12,8 %".replace(" ", " "));
  });

  test("formato es-ES con céntimos y separador de miles", () => {
    assert.equal(nbsp(formatMoney(123456)), "1.234,56 €");
    assert.equal(nbsp(formatMoney(400)), "4,00 €");
    assert.equal(nbsp(formatMoney(-209, "EUR", "always")), "-2,09 €");
  });

  test("rechaza importes no enteros", () => {
    assert.throws(() => sumCents([1.5]));
  });
});

describe("fechas", () => {
  test("fin de mes desde el ancla, sin arrastrar el ajuste", () => {
    assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
    assert.equal(addMonths("2024-01-31", 2), "2024-03-31");
    assert.equal(addMonths("2024-01-31", 3), "2024-04-30");
    assert.equal(addMonths("2023-01-31", 1), "2023-02-28");
  });

  test("año bisiesto en planes anuales", () => {
    assert.equal(addYears("2024-02-29", 1), "2025-02-28");
    assert.equal(addYears("2024-02-29", 4), "2028-02-29");
  });

  test("el calendario de renovaciones sigue avanzando sin pagos registrados", () => {
    assert.equal(nextScheduleDate("2025-01-24", "monthly", "2026-11-17"), "2026-11-24");
    assert.deepEqual(scheduleBetween("2025-01-24", "monthly", "2026-09-01", "2026-11-30"), [
      "2026-09-24",
      "2026-10-24",
      "2026-11-24",
    ]);
  });

  test("días y formato", () => {
    assert.equal(addDays("2026-02-28", 1), "2026-03-01");
    assert.equal(daysBetween("2026-10-13", "2026-11-17"), 35);
    assert.equal(formatDay("2026-09-24", true), "24 sept 2026");
  });
});

describe("plazos y cobertura", () => {
  const monthlyInstallments = (member: string, dueDay: number, count: number, amount = 400): Installment[] =>
    Array.from({ length: count }, (_, index) => {
      const start = addMonths("2026-03-05", index);
      return {
        id: `${member}-${index}`,
        memberId: member,
        amount,
        dueDate: `${start.slice(0, 8)}${String(dueDay).padStart(2, "0")}`,
        coversFrom: start,
        coversUntil: addMonths("2026-03-05", index + 1),
        periodCount: 1,
        estimated: false,
      };
    });

  test("acuerdo anual sobre proveedor mensual: un solo plazo, nunca doce deudas", () => {
    const annual: Installment = {
      id: "jav-0",
      memberId: "jav",
      amount: 4800,
      dueDate: "2026-03-05",
      coversFrom: "2026-03-05",
      coversUntil: "2027-03-05",
      periodCount: 12,
      estimated: true,
    };
    const unpaid = installmentStatus(annual, 0, "2026-11-17", 7);
    assert.equal(unpaid, "overdue");
    const payments: MemberPayment[] = [
      { id: "p", memberId: "jav", amount: 4800, occurredOn: "2026-03-02", status: "confirmed", targetInstallmentId: "jav-0" },
    ];
    const { allocations, credit } = allocatePayments([annual], payments, "2026-11-17");
    assert.equal(allocations.length, 1);
    assert.equal(credit, 0);
    assert.equal(coveredThrough([annual], allocations), "2027-03-04");
  });

  test("un pago parcial no cubre el periodo", () => {
    const installments = monthlyInstallments("luc", 20, 9);
    const payments: MemberPayment[] = installments.map((installment, index) => ({
      id: `p${index}`,
      memberId: "luc",
      amount: index === 8 ? 200 : 400,
      occurredOn: installment.dueDate,
      status: "confirmed",
      targetInstallmentId: installment.id,
    }));
    const { allocations } = allocatePayments(installments, payments, "2026-11-20");
    assert.equal(installmentStatus(installments[8], allocatedTo("luc-8", allocations), "2026-11-20", 7), "partial");
    assert.equal(coveredThrough(installments, allocations), "2026-11-04");
  });

  test("un pago declarado no confirmado no cuenta", () => {
    const installments = monthlyInstallments("pab", 15, 1);
    const payments: MemberPayment[] = [
      { id: "d", memberId: "pab", amount: 400, occurredOn: "2026-03-14", status: "declared", targetInstallmentId: "pab-0" },
    ];
    const { allocations, credit } = allocatePayments(installments, payments, "2026-03-20");
    assert.equal(allocations.length, 0);
    assert.equal(credit, 0);
    assert.equal(installmentStatus(installments[0], 0, "2026-03-20", 7), "pending");
  });

  test("un anticipo sin destino queda como saldo y se aplica a cada plazo al vencer", () => {
    const installments = monthlyInstallments("car", 5, 12);
    const payments: MemberPayment[] = [
      { id: "a", memberId: "car", amount: 2000, occurredOn: "2026-02-20", status: "confirmed" },
    ];
    const { allocations, credit } = allocatePayments(installments, payments, "2026-04-10");
    // Vencidos a 10 de abril: marzo (5 mar) y abril (5 abr). Quedan 12,00 € de saldo.
    assert.equal(allocatedTo("car-0", allocations), 400);
    assert.equal(allocatedTo("car-1", allocations), 400);
    assert.equal(allocatedTo("car-2", allocations), 0);
    assert.equal(credit, 1200);
    assert.ok(allocations.every((allocation) => allocation.origin === "credit"));
  });

  test("si sube el precio, el saldo cubre menos plazos: sigue siendo dinero", () => {
    const installments = monthlyInstallments("car", 5, 3, 500);
    const payments: MemberPayment[] = [
      { id: "a", memberId: "car", amount: 1200, occurredOn: "2026-03-01", status: "confirmed" },
    ];
    const { allocations, credit } = allocatePayments(installments, payments, "2026-05-10");
    assert.equal(allocatedTo("car-0", allocations), 500);
    assert.equal(allocatedTo("car-1", allocations), 500);
    assert.equal(allocatedTo("car-2", allocations), 200);
    assert.equal(credit, 0);
    assert.equal(installmentStatus(installments[2], 200, "2026-05-10", 7), "partial");
  });
});
