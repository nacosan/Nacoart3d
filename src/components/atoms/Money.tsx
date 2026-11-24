import { formatMoney, type Cents, type Currency } from "@/lib/finance/money";

/** Importe completo, céntimos incluidos, con cifras tabulares y sin cortes de línea. */
export function Money({
  cents,
  currency = "EUR",
  sign = "auto",
  className = "",
}: {
  cents: Cents;
  currency?: Currency;
  sign?: "auto" | "always" | "exceptZero";
  className?: string;
}) {
  return <span className={`whitespace-nowrap tabular-nums ${className}`}>{formatMoney(cents, currency, sign)}</span>;
}
