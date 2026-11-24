/**
 * Traduce errores de Supabase a mensajes en español para la interfaz.
 * El error original solo se registra en el servidor.
 */
const DB_MESSAGES: Record<string, string> = {
  not_authenticated: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
  not_found: "No encontramos esa suscripción.",
  invalid_amount: "El importe no es válido.",
  invalid_status: "El estado no es válido.",
  price_not_forward: "El nuevo precio debe empezar después del último cambio de precio.",
  renewal_already_paid: "Esa renovación ya tiene un pago registrado.",
  invalid_plan: "Ese plan ya no está en el catálogo. Elige otro.",
  invalid_capacity: "Indica cuántas personas caben en el plan (entre 2 y 20, contándote).",
  invalid_guest: "El nombre del invitado no es válido.",
  invalid_email: "Uno de los emails no es válido.",
  invite_self: "No puedes invitarte a ti.",
  group_full: "No caben más personas en el grupo.",
  already_invited: "Esa persona ya tiene una invitación pendiente.",
  already_member: "Esa persona ya está en el grupo.",
  invitation_unavailable: "Esa invitación ya no está disponible.",
  invalid_date: "Revisa las fechas.",
  invalid_participation: "Elige si eres propietario o miembro del plan.",
  guest_member: "Esa persona no tiene cuenta: no le puede llegar un aviso en la app.",
  invalid_periods: "Elige cuántos meses cubre el pago.",
  invalid_share: "Tu parte tiene que ser mayor que cero y no superar el precio total.",
};

export const GENERIC_ERROR = "No hemos podido guardar los cambios. Inténtalo de nuevo en un momento.";
export const SETUP_ERROR = "La base de datos todavía no está preparada para esta función.";

interface MaybePgError {
  code?: string;
  message?: string;
}

/** Tabla o función inexistente: la migración aún no se ha aplicado. */
export function isMissingSchema(error: MaybePgError | null | undefined): boolean {
  // 42P01/PGRST205: tabla; PGRST202/42883: función; 42703: columna; PGRST200: relación.
  return Boolean(error && ["42P01", "PGRST205", "PGRST202", "42883", "42703", "PGRST200"].includes(error.code ?? ""));
}

export function userMessage(error: MaybePgError | null | undefined, context: string): string {
  console.error(`[${context}]`, error);
  if (!error) return GENERIC_ERROR;
  if (isMissingSchema(error)) return SETUP_ERROR;
  const known = error.message ? DB_MESSAGES[error.message] : undefined;
  return known ?? GENERIC_ERROR;
}
