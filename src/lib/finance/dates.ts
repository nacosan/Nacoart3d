/**
 * Fechas de calendario como cadenas ISO "AAAA-MM-DD", sin zona horaria.
 * La aritmética se hace con números (año, mes, día), nunca con instantes,
 * para que una fecha no cambie según la zona de quien la mira.
 */
export type ISODate = string;

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(value: ISODate): { year: number; month: number; day: number } {
  const match = ISO_PATTERN.exec(value);
  if (!match) throw new RangeError(`Fecha no válida: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Fecha inexistente: ${value}`);
  }
  return { year, month, day };
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Suma meses desde una fecha ancla, ajustando al último día del mes si hace
 * falta. Siempre se calcula desde el ancla (ancla + k meses), nunca encadenando,
 * para que el 31 de enero dé 29 feb, 31 mar, 30 abr... sin arrastrar el ajuste.
 */
export function addMonths(anchor: ISODate, months: number): ISODate {
  const { year, month, day } = parseISODate(anchor);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return toISODate(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth)));
}

export function addYears(anchor: ISODate, years: number): ISODate {
  return addMonths(anchor, years * 12);
}

const DAY_MS = 86_400_000;

function epochDay(value: ISODate): number {
  const { year, month, day } = parseISODate(value);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function addDays(value: ISODate, days: number): ISODate {
  const shifted = new Date((epochDay(value) + days) * DAY_MS);
  return toISODate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Días desde `from` hasta `to` (positivo si `to` es posterior). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return epochDay(to) - epochDay(from);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Fecha k-ésima de un calendario mensual o anual desde su ancla. */
export function scheduleDate(anchor: ISODate, period: "monthly" | "yearly", index: number): ISODate {
  return addMonths(anchor, period === "monthly" ? index : index * 12);
}

/** Primera fecha del calendario igual o posterior a `onOrAfter`. */
export function nextScheduleDate(
  anchor: ISODate,
  period: "monthly" | "yearly",
  onOrAfter: ISODate,
): ISODate {
  let index = 0;
  let candidate = anchor;
  while (candidate < onOrAfter) {
    index += 1;
    candidate = scheduleDate(anchor, period, index);
  }
  return candidate;
}

/** Fechas del calendario dentro de [from, to] (ambos incluidos). */
export function scheduleBetween(
  anchor: ISODate,
  period: "monthly" | "yearly",
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const dates: ISODate[] = [];
  for (let index = 0; ; index += 1) {
    const candidate = scheduleDate(anchor, period, index);
    if (candidate > to) break;
    if (candidate >= from) dates.push(candidate);
  }
  return dates;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "24 nov" o "24 nov 2026". */
export function formatDay(value: ISODate, withYear = false): string {
  const { year, month, day } = parseISODate(value);
  return `${day} ${MONTHS_SHORT[month - 1]}${withYear ? ` ${year}` : ""}`;
}

/** "nov 2026" */
export function formatMonthShort(value: ISODate): string {
  const { year, month } = parseISODate(value);
  return `${MONTHS_SHORT[month - 1]} ${year}`;
}

/** "noviembre de 2026" */
export function formatMonthLong(value: ISODate): string {
  const { year, month } = parseISODate(value);
  return `${MONTHS_LONG[month - 1]} de ${year}`;
}

export function monthKey(value: ISODate): string {
  return value.slice(0, 7);
}
