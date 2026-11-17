import { formatMonthLong } from "@/lib/finance/dates";
import { formatMoney } from "@/lib/finance/money";
import type { GroupModel, MemberLedger, ProviderPeriod } from "@/prototype/model";

export type SegmentKind =
  | "paid"
  | "paidCredit"
  | "partial"
  | "pending"
  | "awaiting"
  | "overdue"
  | "scheduled"
  | "provider";

export interface Segment {
  key: string;
  start: number;
  span: number;
  kind: SegmentKind;
  /** Texto corto visible cuando cabe. */
  short: string;
  /** Descripción completa (lectores de pantalla y título al pasar el ratón). */
  detail: string;
}

export const SEGMENT_LABEL: Record<SegmentKind, string> = {
  paid: "Pagado",
  paidCredit: "Pagado con saldo a favor",
  partial: "Pago parcial",
  pending: "Pendiente",
  awaiting: "Pago por confirmar",
  overdue: "Vencido",
  scheduled: "Previsto",
  provider: "Pagado al proveedor",
};

function range(periods: ProviderPeriod[], start: number, span: number): string {
  const first = periods[start];
  const last = periods[Math.min(start + span, periods.length) - 1];
  if (!first || !last) return "";
  return span === 1 ? formatMonthLong(first.start) : `${formatMonthLong(first.start)} a ${formatMonthLong(last.start)}`;
}

export function memberSegments(ledger: MemberLedger, periods: ProviderPeriod[]): Segment[] {
  return ledger.installments.map((installment) => {
    const span = Math.min(installment.periodCount, periods.length - installment.firstPeriodIndex);
    const when = range(periods, installment.firstPeriodIndex, span);
    const amount = formatMoney(installment.amount);
    let kind: SegmentKind;
    let detail: string;
    switch (installment.status) {
      case "paid":
        kind = installment.fromCredit === installment.amount ? "paidCredit" : "paid";
        detail = `${when}: ${SEGMENT_LABEL[kind].toLowerCase()}, ${amount}`;
        break;
      case "partial":
        kind = "partial";
        detail = `${when}: pago parcial, ${formatMoney(installment.allocated)} de ${amount}`;
        break;
      case "overdue":
        kind = "overdue";
        detail = `${when}: vencido, faltan ${formatMoney(installment.amount - installment.allocated)}`;
        break;
      case "pending":
        kind = installment.declared > 0 ? "awaiting" : "pending";
        detail =
          kind === "awaiting"
            ? `${when}: pago de ${formatMoney(installment.declared)} declarado, por confirmar`
            : `${when}: pendiente, ${amount}`;
        break;
      default:
        kind = "scheduled";
        detail = `${when}: previsto, ${amount}${installment.estimated ? " (estimado con el precio actual)" : ""}`;
    }
    const short =
      span >= 3
        ? `${SEGMENT_LABEL[kind]} · ${amount}${installment.periodCount === 12 ? " (anual)" : ""}`
        : SEGMENT_LABEL[kind];
    return { key: installment.id, start: installment.firstPeriodIndex, span, kind, short, detail };
  });
}

/** Fila del líder: sus pagos al proveedor por periodo. */
export function providerSegments(group: GroupModel): Segment[] {
  return group.periods.map((period) => {
    const payment = group.spec.providerPayments.find((item) => item.periodIndex === period.index);
    const when = formatMonthLong(period.start);
    return payment
      ? {
          key: `prov-${period.index}`,
          start: period.index,
          span: 1,
          kind: "provider" as const,
          short: SEGMENT_LABEL.provider,
          detail: `${when}: pagado al proveedor, ${formatMoney(payment.amount)}`,
        }
      : {
          key: `prov-${period.index}`,
          start: period.index,
          span: 1,
          kind: "scheduled" as const,
          short: SEGMENT_LABEL.scheduled,
          detail: `${when}: pago al proveedor previsto, ${formatMoney(group.spec.price)}`,
        };
  });
}
