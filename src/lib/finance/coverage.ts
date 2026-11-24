import { addDays, addMonths, formatDay, type ISODate } from "./dates.ts";

/**
 * Periodo que cubre un pago que empieza en una renovación y abarca `periods`
 * renovaciones: del día de la renovación al día anterior a la siguiente.
 * Ejemplo (mensual, 1): 23 nov 2026 → "23 nov 2026 – 22 dic 2026".
 */
export function coverageOf(start: ISODate, billingPeriod: "monthly" | "yearly", periods: number) {
  const months = (billingPeriod === "monthly" ? 1 : 12) * Math.max(1, periods);
  const through = addDays(addMonths(start, months), -1);
  return { through, label: `${formatDay(start, true)} – ${formatDay(through, true)}` };
}
