import type { ISODate } from "./finance/dates";

export const TIMEZONES = [
  { id: "Europe/Madrid", label: "Madrid (península y Baleares)" },
  { id: "Atlantic/Canary", label: "Canarias" },
  { id: "Europe/Lisbon", label: "Lisboa" },
  { id: "Europe/London", label: "Londres" },
  { id: "America/Mexico_City", label: "Ciudad de México" },
  { id: "America/Bogota", label: "Bogotá" },
  { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { id: "America/New_York", label: "Nueva York" },
] as const;

export function isTimezone(value: unknown): value is (typeof TIMEZONES)[number]["id"] {
  return typeof value === "string" && TIMEZONES.some((zone) => zone.id === value);
}

/** Fecha de hoy en la zona de la persona, como "AAAA-MM-DD". */
export function todayIn(timezone: string): ISODate {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(),
    );
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(),
    );
  }
}

/** "hoy", "mañana", "en 5 días", "hace 3 días". */
export function relativeDays(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days === -1) return "ayer";
  return days > 0 ? `en ${days} días` : `hace ${-days} días`;
}
