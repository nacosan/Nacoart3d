/**
 * Importes en céntimos enteros. Nunca se opera con coma flotante:
 * la división entre 100 solo ocurre al formatear para mostrar.
 */
export type Currency = "EUR" | "USD" | "GBP";
export type Cents = number;
export type BillingPeriod = "monthly" | "yearly";

export function assertCents(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Importe no entero en céntimos: ${value}`);
  }
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const value of values) {
    assertCents(value);
    total += value;
  }
  return total;
}

type SignDisplay = "auto" | "always" | "exceptZero";
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency, signDisplay: SignDisplay): Intl.NumberFormat {
  const key = `${currency}:${signDisplay}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      useGrouping: "always",
      signDisplay,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, cached);
  }
  return cached;
}

/** "1.234,56 €". El espacio antes del símbolo es no separable. */
export function formatMoney(
  cents: Cents,
  currency: Currency = "EUR",
  signDisplay: SignDisplay = "auto",
): string {
  assertCents(cents);
  return formatter(currency, signDisplay).format(cents / 100);
}

/**
 * Reparto igualitario: cada participante recibe floor(total / n) y los
 * céntimos sobrantes (como mucho n - 1) van al participante indicado.
 * La suma del resultado es exactamente el total.
 */
export function splitEqual(total: Cents, participants: number, remainderTo = 0): Cents[] {
  assertCents(total);
  if (!Number.isInteger(participants) || participants < 1) {
    throw new RangeError("Hace falta al menos un participante");
  }
  if (remainderTo < 0 || remainderTo >= participants) {
    throw new RangeError("El destinatario de los céntimos no es un participante");
  }
  const base = Math.floor(total / participants);
  const remainder = total - base * participants;
  return Array.from({ length: participants }, (_, index) =>
    index === remainderTo ? base + remainder : base,
  );
}

/**
 * Cuotas fijas: el titular asume el resto del total. Devuelve null si las
 * cuotas fijas superan el total (no se puede repartir).
 */
export function splitFixed(total: Cents, fixedShares: readonly Cents[]): { holderShare: Cents } | null {
  const fixed = sumCents(fixedShares);
  const holderShare = total - fixed;
  return holderShare < 0 ? null : { holderShare };
}

/** Coste mensual equivalente. Un anual se divide entre 12 y se redondea al céntimo. */
export function monthlyEquivalent(amount: Cents, period: BillingPeriod): Cents {
  assertCents(amount);
  return period === "monthly" ? amount : Math.round(amount / 12);
}

/** Coste anual equivalente, siempre a partir del importe contratado. */
export function annualEquivalent(amount: Cents, period: BillingPeriod): Cents {
  assertCents(amount);
  return period === "yearly" ? amount : amount * 12;
}

/** Porcentaje de part sobre total; null si el total es cero (no se muestra porcentaje). */
export function percentOf(part: Cents, total: Cents): number | null {
  if (total === 0) return null;
  return (part / total) * 100;
}

const percentFormat = new Intl.NumberFormat("es-ES", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function formatPercent(value: number | null): string {
  return value === null ? "—" : percentFormat.format(value / 100);
}

export const CURRENCIES: readonly Currency[] = ["EUR", "USD", "GBP"];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Convierte lo que escribe una persona ("12,99", "1.234,5", "7", "7.99") en
 * céntimos enteros, sin pasar por coma flotante. Devuelve null si no es un
 * importe válido (negativo, más de dos decimales o texto).
 */
export function parseAmountToCents(input: string): Cents | null {
  const raw = input.replace(/[\s €$£]/g, "");
  if (raw === "") return null;
  let normalized: string;
  if (raw.includes(",")) {
    // Formato español: los puntos son separadores de miles.
    if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(raw)) return null;
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(raw)) {
    normalized = raw;
  } else if (/^\d{1,3}(\.\d{3})+$|^\d+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else {
    return null;
  }
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** "12,99" para rellenar un campo de importe. */
export function centsToInput(cents: Cents): string {
  assertCents(cents);
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole},${fraction}`;
}
