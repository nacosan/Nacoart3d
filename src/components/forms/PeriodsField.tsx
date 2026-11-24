"use client";

import { Field } from "./Field";

const OPTIONS = [
  { value: 1, label: "Solo esta renovación" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "Todo el año (12 meses)" },
];

/**
 * Cuántas renovaciones seguidas cubre un pago. Solo en planes mensuales: en
 * uno anual cada pago ya es un año, así que se envía 1 sin preguntar.
 */
export function PeriodsField({
  billingPeriod,
  value,
  onChange,
  error,
}: {
  billingPeriod: "monthly" | "yearly";
  value: number;
  onChange: (periods: number) => void;
  error?: string;
}) {
  if (billingPeriod === "yearly") return <input type="hidden" name="periods" value="1" />;
  return (
    <Field label="¿Cuántos meses cubre?" name="periods" error={error} hint="Si paga varios meses de golpe, se marcan todos como pagados.">
      {(props) => (
        <select {...props} name="periods" value={value} onChange={(event) => onChange(Number(event.target.value))}>
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
