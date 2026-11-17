/**
 * Plazos (vencimientos reales del acuerdo de pago de un participante),
 * asignación de cobros y cobertura económica.
 *
 * Reglas (docs/propuesta-mvp.md §2.8):
 * - Solo los cobros confirmados se asignan. Uno declarado no cambia el estado.
 * - Un cobro dirigido a un plazo se aplica a ese plazo; lo que sobra es saldo a favor.
 * - Un cobro sin destino paga primero los plazos ya vencidos más antiguos; lo que
 *   sobra es saldo a favor.
 * - El saldo a favor se aplica a cada plazo cuando vence, por el importe del plazo.
 * - Un pago parcial nunca cubre un periodo.
 */
import type { Cents } from "./money.ts";
import type { ISODate } from "./dates.ts";
import { addDays } from "./dates.ts";

export interface Installment {
  id: string;
  memberId: string;
  amount: Cents;
  dueDate: ISODate;
  /** Inicio del primer periodo del proveedor que cubre. */
  coversFrom: ISODate;
  /** Fin (excluido) del último periodo que cubre. */
  coversUntil: ISODate;
  /** Número de periodos del proveedor que cubre (1 mensual, 12 anual sobre proveedor mensual). */
  periodCount: number;
  /** El importe sale del precio vigente y puede ajustarse si cambia el coste real. */
  estimated: boolean;
}

export type EntryStatus = "declared" | "confirmed" | "rejected" | "voided";

export interface MemberPayment {
  id: string;
  memberId: string;
  amount: Cents;
  occurredOn: ISODate;
  status: EntryStatus;
  /** Plazo al que el líder aplicó el cobro, si lo indicó. */
  targetInstallmentId?: string;
}

export interface Allocation {
  paymentId: string;
  installmentId: string;
  amount: Cents;
  origin: "payment" | "credit";
  appliedOn: ISODate;
}

export type InstallmentStatus = "paid" | "partial" | "pending" | "overdue" | "scheduled";

interface CreditChunk {
  paymentId: string;
  remaining: Cents;
}

/**
 * Asigna los cobros confirmados de UN participante a sus plazos, en orden cronológico.
 * Devuelve las asignaciones y el saldo a favor que queda sin asignar.
 */
export function allocatePayments(
  installments: readonly Installment[],
  payments: readonly MemberPayment[],
  today: ISODate,
): { allocations: Allocation[]; credit: Cents } {
  const outstanding = new Map<string, Cents>(installments.map((item) => [item.id, item.amount]));
  const byDue = [...installments].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  const allocations: Allocation[] = [];
  const credit: CreditChunk[] = [];

  type TimelineEvent =
    | { date: ISODate; order: 0; payment: MemberPayment }
    | { date: ISODate; order: 1; installment: Installment };

  const events: TimelineEvent[] = [];
  for (const payment of payments) {
    if (payment.status === "confirmed" && payment.occurredOn <= today) {
      events.push({ date: payment.occurredOn, order: 0, payment });
    }
  }
  for (const installment of byDue) {
    if (installment.dueDate <= today && installment.coversFrom <= today) {
      events.push({ date: installment.dueDate, order: 1, installment });
    }
  }
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));

  const apply = (installmentId: string, paymentId: string, available: Cents, origin: Allocation["origin"], on: ISODate) => {
    const due = outstanding.get(installmentId) ?? 0;
    const amount = Math.min(due, available);
    if (amount > 0) {
      outstanding.set(installmentId, due - amount);
      allocations.push({ paymentId, installmentId, amount, origin, appliedOn: on });
    }
    return amount;
  };

  for (const event of events) {
    if (event.order === 0) {
      const { payment } = event;
      let left = payment.amount;
      if (payment.targetInstallmentId) {
        left -= apply(payment.targetInstallmentId, payment.id, left, "payment", payment.occurredOn);
      } else {
        for (const installment of byDue) {
          if (left === 0) break;
          if (installment.dueDate <= payment.occurredOn) {
            left -= apply(installment.id, payment.id, left, "payment", payment.occurredOn);
          }
        }
      }
      if (left > 0) credit.push({ paymentId: payment.id, remaining: left });
    } else {
      const { installment } = event;
      for (const chunk of credit) {
        if ((outstanding.get(installment.id) ?? 0) === 0) break;
        if (chunk.remaining === 0) continue;
        chunk.remaining -= apply(installment.id, chunk.paymentId, chunk.remaining, "credit", installment.dueDate);
      }
    }
  }

  return { allocations, credit: credit.reduce((sum, chunk) => sum + chunk.remaining, 0) };
}

export function allocatedTo(installmentId: string, allocations: readonly Allocation[]): Cents {
  let total = 0;
  for (const allocation of allocations) {
    if (allocation.installmentId === installmentId) total += allocation.amount;
  }
  return total;
}

export function installmentStatus(
  installment: Installment,
  allocated: Cents,
  today: ISODate,
  graceDays: number,
): InstallmentStatus {
  if (allocated >= installment.amount) return "paid";
  if (today > addDays(installment.dueDate, graceDays)) return "overdue";
  if (installment.coversFrom > today) return "scheduled";
  if (allocated > 0) return "partial";
  return "pending";
}

/** Fecha desde la que un plazo no pagado se considera vencido. */
export function overdueSince(installment: Installment, graceDays: number): ISODate {
  return addDays(installment.dueDate, graceDays + 1);
}

/**
 * Último día cubierto económicamente: el final del último plazo pagado del todo,
 * sin huecos desde el primero. null si el primer plazo no está pagado.
 */
export function coveredThrough(
  installments: readonly Installment[],
  allocations: readonly Allocation[],
): ISODate | null {
  const ordered = [...installments].sort((a, b) => (a.coversFrom < b.coversFrom ? -1 : 1));
  let lastEnd: ISODate | null = null;
  for (const installment of ordered) {
    if (allocatedTo(installment.id, allocations) < installment.amount) break;
    lastEnd = installment.coversUntil;
  }
  return lastEnd === null ? null : addDays(lastEnd, -1);
}
