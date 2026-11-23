import { parseISODate, type ISODate } from "./finance/dates";

export function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Fecha "AAAA-MM-DD" válida (existe en el calendario) o null. */
export function isoDate(value: string): ISODate | null {
  try {
    parseISODate(value);
    return value;
  } catch {
    return null;
  }
}

/** Valores enviados para devolverlos al formulario si hay errores. */
export function echo(formData: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, str(formData, name)]));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(value: string): string | null {
  return UUID.test(value) ? value : null;
}
