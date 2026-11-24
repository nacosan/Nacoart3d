"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/molecules/FormState";
import { getSession } from "@/lib/data/session";
import { GENERIC_ERROR, userMessage } from "@/lib/errors";
import { parseAmountToCents } from "@/lib/finance/money";
import { isoDate, str, uuid } from "@/lib/forms";

const SESSION_EXPIRED: FormState = { tone: "error", message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function done(path: string, message: string): FormState {
  revalidatePath("/", "layout");
  revalidatePath(path);
  return { tone: "success", message };
}

export async function shareSubscription(subscriptionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SESSION_EXPIRED;
  if (!uuid(subscriptionId)) return { tone: "error", message: GENERIC_ERROR };
  const raw = str(formData, "maxMembers");
  const max = raw ? Number(raw) : null;
  if (max !== null && (!Number.isInteger(max) || max < 2 || max > 20)) {
    return { fieldErrors: { maxMembers: "Entre 2 y 20 personas, contándote." }, values: { maxMembers: raw } };
  }
  const { error } = await session.supabase.rpc("share_subscription", { p_subscription_id: subscriptionId, p_max_members: max });
  if (error) {
    const message = userMessage(error, "compartir");
    return error.message === "invalid_capacity" ? { fieldErrors: { maxMembers: message }, values: { maxMembers: raw } } : { tone: "error", message };
  }
  return done(`/suscripciones/${subscriptionId}`, "Ahora es un plan compartido. Añade a las personas con las que lo compartes.");
}

export async function addGuest(subscriptionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SESSION_EXPIRED;
  const name = str(formData, "guestName");
  if (!uuid(subscriptionId)) return { tone: "error", message: GENERIC_ERROR };
  if (name.length < 1 || name.length > 60) return { fieldErrors: { guestName: "Escribe un nombre de hasta 60 caracteres." }, values: { guestName: name } };
  const { error } = await session.supabase.rpc("add_group_guest", { p_subscription_id: subscriptionId, p_name: name });
  if (error) return { fieldErrors: { guestName: userMessage(error, "añadir invitado") }, values: { guestName: name } };
  return done(`/suscripciones/${subscriptionId}`, `${name} se ha añadido al grupo.`);
}

export async function inviteMember(subscriptionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SESSION_EXPIRED;
  const email = str(formData, "email").toLowerCase();
  if (!uuid(subscriptionId)) return { tone: "error", message: GENERIC_ERROR };
  if (!EMAIL.test(email)) return { fieldErrors: { email: "Escribe un email válido." }, values: { email } };
  const { error } = await session.supabase.rpc("invite_group_member", { p_subscription_id: subscriptionId, p_email: email });
  if (error) return { fieldErrors: { email: userMessage(error, "invitar") }, values: { email } };
  return done(
    `/suscripciones/${subscriptionId}`,
    `Invitación enviada a ${email}. La verá al entrar en la app con ese email. Si aún no tiene cuenta, la verá cuando se registre.`,
  );
}

async function simple(
  rpc: string,
  args: Record<string, string>,
  context: string,
  back: string,
  extra: Record<string, boolean> = {},
): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/acceso");
  // Todos los identificadores tienen que ser UUID válidos.
  if (Object.values(args).some((value) => !uuid(value))) redirect(`${back}?error=1`);
  const { error } = await session.supabase.rpc(rpc, { ...args, ...extra });
  if (error) {
    userMessage(error, context);
    redirect(`${back}?error=1`);
  }
  revalidatePath("/", "layout");
}

export async function revokeInvitation(subscriptionId: string, invitationId: string): Promise<void> {
  await simple("revoke_invitation", { p_invitation_id: invitationId }, "revocar invitación", `/suscripciones/${subscriptionId}`);
  redirect(`/suscripciones/${subscriptionId}?revocada=1#personas`);
}

export async function removeMember(subscriptionId: string, memberId: string): Promise<void> {
  await simple("remove_group_member", { p_member_id: memberId }, "quitar miembro", `/suscripciones/${subscriptionId}`);
  redirect(`/suscripciones/${subscriptionId}?quitado=1#personas`);
}

export async function acceptInvitation(invitationId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/acceso");
  if (!uuid(invitationId)) redirect("/?invitacion=error");
  const { data, error } = await session.supabase.rpc("accept_invitation", { p_invitation_id: invitationId });
  if (error || typeof data !== "string") {
    userMessage(error, "aceptar invitación");
    redirect(`/?invitacion=${error?.message === "group_full" ? "llena" : "error"}`);
  }
  revalidatePath("/", "layout");
  redirect(`/suscripciones/${data}?unido=1`);
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await simple("decline_invitation", { p_invitation_id: invitationId }, "rechazar invitación", "/");
  redirect("/?invitacion=rechazada");
}

export async function leaveGroup(subscriptionId: string): Promise<void> {
  await simple("leave_group", { p_subscription_id: subscriptionId }, "salir del grupo", `/suscripciones/${subscriptionId}`);
  redirect("/suscripciones?salido=1");
}

export async function recordMemberPayment(subscriptionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SESSION_EXPIRED;
  const values = {
    memberId: str(formData, "memberId"),
    renewalDate: str(formData, "renewalDate"),
    amount: str(formData, "amount"),
    paidOn: str(formData, "paidOn"),
    note: str(formData, "note"),
  };
  const fieldErrors: Record<string, string> = {};
  const memberId = uuid(values.memberId);
  if (!memberId) fieldErrors.memberId = "Elige quién ha pagado.";
  const renewalDate = isoDate(values.renewalDate);
  if (!renewalDate) fieldErrors.renewalDate = "Elige qué mes paga.";
  const amount = parseAmountToCents(values.amount);
  if (amount === null || amount <= 0) fieldErrors.amount = "Escribe un importe mayor que cero, por ejemplo 3,50.";
  const paidOn = isoDate(values.paidOn);
  if (!paidOn) fieldErrors.paidOn = "Elige la fecha del pago.";
  if (values.note.length > 200) fieldErrors.note = "La nota puede tener hasta 200 caracteres.";
  const periods = Number(str(formData, "periods") || "1");
  if (!Number.isInteger(periods) || periods < 1 || periods > 24) fieldErrors.periods = "Elige cuántos meses cubre.";
  const key = uuid(str(formData, "idempotencyKey"));
  if (!uuid(subscriptionId) || !key) return { tone: "error", message: GENERIC_ERROR, values };
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const { error } = await session.supabase.rpc("record_member_payment", {
    p_member_id: memberId,
    p_renewal_date: renewalDate,
    p_amount_cents: amount,
    p_paid_on: paidOn,
    p_note: values.note || null,
    p_idempotency_key: key,
    p_periods: periods,
  });
  if (error) return { tone: "error", message: userMessage(error, "anotar cobro"), values };
  revalidatePath("/", "layout");
  redirect(`/suscripciones/${subscriptionId}?cobro=1#cobros`);
}

/** Confirma o rechaza un pago declarado. Desde el Resumen ("/") vuelve allí; si no, a la suscripción. */
export async function reviewMemberPayment(subscriptionId: string, paymentId: string, accept: boolean, from: "resumen" | "suscripcion"): Promise<void> {
  const back = from === "resumen" ? "/" : `/suscripciones/${subscriptionId}`;
  await simple("review_member_payment", { p_payment_id: paymentId }, "revisar cobro", back, { p_accept: accept });
  redirect(from === "resumen" ? `/?pago=${accept ? "confirmado" : "rechazado"}` : `${back}?${accept ? "confirmado" : "rechazado"}=1`);
}

export async function voidMemberPayment(subscriptionId: string, paymentId: string): Promise<void> {
  await simple("void_member_payment", { p_payment_id: paymentId }, "anular cobro", `/suscripciones/${subscriptionId}`);
  redirect(`/suscripciones/${subscriptionId}?cobroAnulado=1#cobros`);
}

/** Recordatorio de pago a un miembro con cuenta (le aparece en su Resumen). */
export async function sendPaymentReminder(
  subscriptionId: string,
  memberId: string,
  renewalDate: string,
  amountCents: number,
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || !uuid(subscriptionId) || !uuid(memberId) || !isoDate(renewalDate) || !Number.isSafeInteger(amountCents)) {
    return { ok: false };
  }
  const { error } = await session.supabase.rpc("send_payment_reminder", {
    p_member_id: memberId,
    p_renewal_date: renewalDate,
    p_amount_cents: amountCents,
  });
  if (error) {
    userMessage(error, "recordatorio");
    return { ok: false };
  }
  revalidatePath(`/suscripciones/${subscriptionId}`);
  return { ok: true };
}

export async function dismissPaymentReminder(reminderId: string): Promise<void> {
  await simple("dismiss_payment_reminder", { p_reminder_id: reminderId }, "cerrar recordatorio", "/");
  redirect("/");
}
