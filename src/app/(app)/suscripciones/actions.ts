"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms/FormState";
import { isCategoryId } from "@/lib/catalog";
import { getSession } from "@/lib/data/session";
import { GENERIC_ERROR, userMessage } from "@/lib/errors";
import { isCurrency, parseAmountToCents } from "@/lib/finance/money";
import { echo, isoDate, str, uuid } from "@/lib/forms";

const SESSION_EXPIRED: FormState = { tone: "error", message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
const MAX_AMOUNT = 100_000_00;

function amountError(cents: number | null, allowZero: boolean): string | undefined {
  if (cents === null) return "Escribe un importe, por ejemplo 12,99.";
  if (!allowZero && cents === 0) return "El importe tiene que ser mayor que cero.";
  if (cents > MAX_AMOUNT) return "Ese importe parece demasiado alto. Revísalo.";
  return undefined;
}

function urlError(value: string): string | undefined {
  if (!value) return undefined;
  if (value.length > 500 || !/^https?:\/\/\S+$/i.test(value)) return "Escribe una dirección completa que empiece por https://";
  try {
    new URL(value);
    return undefined;
  } catch {
    return "Esa dirección no es válida.";
  }
}

const CREATE_FIELDS = [
  "name",
  "category",
  "currency",
  "period",
  "anchor",
  "status",
  "amount",
  "manageUrl",
  "notes",
  "planId",
  "shared",
  "maxMembers",
  "participation",
  "myShare",
  "planOwnerName",
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SESSION_EXPIRED;
  const values = echo(formData, CREATE_FIELDS);
  const fieldErrors: Record<string, string> = {};

  const name = values.name;
  if (name.length < 1 || name.length > 80) fieldErrors.name = "Escribe el nombre del servicio (hasta 80 caracteres).";
  if (!isCategoryId(values.category)) fieldErrors.category = "Elige una categoría.";
  if (!isCurrency(values.currency)) fieldErrors.currency = "Elige una moneda.";
  if (values.period !== "monthly" && values.period !== "yearly") fieldErrors.period = "Elige cada cuánto pagas.";
  const anchor = isoDate(values.anchor);
  if (!anchor) fieldErrors.anchor = "Elige la fecha en que se cobra.";
  if (!["active", "trial", "paused"].includes(values.status)) fieldErrors.status = "Elige un estado.";
  const amount = parseAmountToCents(values.amount);
  const amountProblem = amountError(amount, true);
  if (amountProblem) fieldErrors.amount = amountProblem;
  const urlProblem = urlError(values.manageUrl);
  if (urlProblem) fieldErrors.manageUrl = urlProblem;
  if (values.notes.length > 1000) fieldErrors.notes = "Las notas pueden tener hasta 1000 caracteres.";
  const planId = /^[a-z0-9-]{1,80}$/.test(values.planId) ? values.planId : null;

  // Miembro de un plan que paga otra persona: se guarda su parte y no se crea grupo.
  const asMember = values.participation === "member";
  let myShare: number | null = null;
  if (asMember) {
    myShare = parseAmountToCents(values.myShare);
    if (myShare === null || myShare <= 0) fieldErrors.myShare = "Escribe cuánto pagas tú, por ejemplo 3,50.";
    else if (amount !== null && myShare > amount) fieldErrors.myShare = "Tu parte no puede ser mayor que el precio total.";
    if (values.planOwnerName.length > 60) fieldErrors.planOwnerName = "El nombre puede tener hasta 60 caracteres.";
  }
  const shared = values.shared === "on" && !asMember;
  const guests = formData.getAll("guests").map((value) => String(value).trim()).filter(Boolean);
  const invites = formData.getAll("invites").map((value) => String(value).trim().toLowerCase()).filter(Boolean);
  let maxMembers: number | null = null;
  if (shared) {
    if (values.maxMembers) {
      maxMembers = Number(values.maxMembers);
      if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 20) {
        fieldErrors.maxMembers = "Entre 2 y 20 personas, contándote.";
      }
    }
    if (guests.some((guest) => guest.length > 60)) fieldErrors.members = "Los nombres pueden tener hasta 60 caracteres.";
    if (invites.some((email) => !EMAIL.test(email))) fieldErrors.members = "Revisa los emails: alguno no es válido.";
    if (maxMembers !== null && 1 + guests.length + invites.length > maxMembers) {
      fieldErrors.members = `Has añadido más personas de las que caben (${maxMembers}, contándote).`;
    }
  }

  const key = uuid(str(formData, "idempotencyKey"));
  if (!key) return { tone: "error", message: GENERIC_ERROR, values };
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const { data, error } = await session.supabase.rpc("create_subscription", {
    p_name: name,
    p_category_id: values.category,
    p_currency: values.currency,
    p_billing_period: values.period,
    p_renewal_anchor: anchor,
    p_status: values.status,
    p_amount_cents: amount,
    p_manage_url: values.manageUrl || null,
    p_notes: values.notes || null,
    p_idempotency_key: key,
    p_plan_id: planId,
    p_shared: shared,
    p_max_members: maxMembers,
    p_guests: shared ? guests : [],
    p_invite_emails: shared ? invites : [],
    p_participation: asMember ? "member" : "owner",
    p_my_share_cents: asMember ? myShare : null,
    p_plan_owner_name: asMember ? values.planOwnerName || null : null,
  });
  if (error || typeof data !== "string") {
    const message = userMessage(error, "crear suscripción");
    const memberErrors = ["group_full", "invalid_email", "invite_self", "invalid_guest"];
    if (error && memberErrors.includes(error.message)) return { fieldErrors: { members: message }, values };
    if (error?.message === "invalid_capacity") return { fieldErrors: { maxMembers: message }, values };
    if (error?.message === "invalid_share") return { fieldErrors: { myShare: message }, values };
    return { tone: "error", message, values };
  }

  revalidatePath("/", "layout");
  redirect(`/suscripciones/${data}?creada=1`);
}

const EDIT_FIELDS = ["name", "category", "status", "cancelledOn", "paidThrough", "manageUrl", "notes", "participation", "myShare", "planOwnerName"];

export async function updateSubscription(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SESSION_EXPIRED;
  if (!uuid(id)) return { tone: "error", message: GENERIC_ERROR };
  const values = echo(formData, EDIT_FIELDS);
  const fieldErrors: Record<string, string> = {};

  if (values.name.length < 1 || values.name.length > 80) fieldErrors.name = "Escribe el nombre del servicio (hasta 80 caracteres).";
  if (!isCategoryId(values.category)) fieldErrors.category = "Elige una categoría.";
  if (!["active", "trial", "paused", "cancelled"].includes(values.status)) fieldErrors.status = "Elige un estado.";
  const cancelled = values.status === "cancelled";
  const cancelledOn = cancelled ? isoDate(values.cancelledOn) : null;
  const paidThrough = cancelled && values.paidThrough ? isoDate(values.paidThrough) : null;
  if (cancelled && !cancelledOn) fieldErrors.cancelledOn = "Indica cuándo la cancelaste.";
  if (cancelled && values.paidThrough && !paidThrough) fieldErrors.paidThrough = "Esa fecha no es válida.";
  const urlProblem = urlError(values.manageUrl);
  if (urlProblem) fieldErrors.manageUrl = urlProblem;
  if (values.notes.length > 1000) fieldErrors.notes = "Las notas pueden tener hasta 1000 caracteres.";
  const asMember = values.participation === "member";
  const myShare = asMember ? parseAmountToCents(values.myShare) : null;
  if (asMember && (myShare === null || myShare <= 0)) fieldErrors.myShare = "Escribe cuánto pagas tú, por ejemplo 3,50.";
  if (asMember && values.planOwnerName.length > 60) fieldErrors.planOwnerName = "El nombre puede tener hasta 60 caracteres.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const { error, count } = await session.supabase
    .from("subscriptions")
    .update(
      {
        ...(asMember ? { my_share_cents: myShare, plan_owner_name: values.planOwnerName || null } : {}),
        name: values.name,
        category_id: values.category,
        status: values.status,
        cancelled_on: cancelledOn,
        paid_through_date: paidThrough,
        manage_url: values.manageUrl || null,
        notes: values.notes || null,
      },
      { count: "exact" },
    )
    .eq("id", id)
    .eq("owner_id", session.userId);
  if (error) return { tone: "error", message: userMessage(error, "editar suscripción"), values };
  if (count === 0) return { tone: "error", message: "No encontramos esa suscripción.", values };

  revalidatePath("/", "layout");
  redirect(`/suscripciones/${id}?guardada=1`);
}

export async function changePrice(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SESSION_EXPIRED;
  if (!uuid(id)) return { tone: "error", message: GENERIC_ERROR };
  const values = echo(formData, ["amount", "effectiveFrom"]);
  const fieldErrors: Record<string, string> = {};
  const amount = parseAmountToCents(values.amount);
  const amountProblem = amountError(amount, true);
  if (amountProblem) fieldErrors.amount = amountProblem;
  const effectiveFrom = isoDate(values.effectiveFrom);
  if (!effectiveFrom) fieldErrors.effectiveFrom = "Elige desde cuándo aplica.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const { error } = await session.supabase.rpc("set_subscription_price", {
    p_subscription_id: id,
    p_amount_cents: amount,
    p_effective_from: effectiveFrom,
  });
  if (error) {
    const message = userMessage(error, "cambiar precio");
    return error.message === "price_not_forward" ? { fieldErrors: { effectiveFrom: message }, values } : { tone: "error", message, values };
  }
  revalidatePath("/", "layout");
  return { tone: "success", message: "Precio actualizado. Las renovaciones anteriores conservan su precio." };
}

export async function registerPayment(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SESSION_EXPIRED;
  if (!uuid(id)) return { tone: "error", message: GENERIC_ERROR };
  const values = echo(formData, ["amount", "occurredOn", "renewalDate", "concept"]);
  const fieldErrors: Record<string, string> = {};
  const amount = parseAmountToCents(values.amount);
  const amountProblem = amountError(amount, false);
  if (amountProblem) fieldErrors.amount = amountProblem;
  const occurredOn = isoDate(values.occurredOn);
  if (!occurredOn) fieldErrors.occurredOn = "Elige la fecha del pago.";
  const renewalDate = values.renewalDate ? isoDate(values.renewalDate) : null;
  if (values.renewalDate && !renewalDate) fieldErrors.renewalDate = "Elige una renovación de la lista.";
  if (values.concept.length > 200) fieldErrors.concept = "El concepto puede tener hasta 200 caracteres.";
  const key = uuid(str(formData, "idempotencyKey"));
  if (!key) return { tone: "error", message: GENERIC_ERROR, values };
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const { error } = await session.supabase.rpc("register_personal_payment", {
    p_subscription_id: id,
    p_amount_cents: amount,
    p_occurred_on: occurredOn,
    p_renewal_date: renewalDate,
    p_concept: values.concept || null,
    p_idempotency_key: key,
  });
  if (error) {
    const message = userMessage(error, "registrar pago");
    return error.message === "renewal_already_paid" ? { fieldErrors: { renewalDate: message }, values } : { tone: "error", message, values };
  }
  revalidatePath("/", "layout");
  redirect(`/suscripciones/${id}?pago=1#historial`);
}

export async function voidPayment(subscriptionId: string, entryId: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/acceso");
  const key = uuid(str(formData, "idempotencyKey"));
  if (!uuid(subscriptionId) || !uuid(entryId) || !key) redirect(`/suscripciones/${subscriptionId}?error=1`);
  const { error } = await session.supabase.rpc("void_personal_payment", { p_entry_id: entryId, p_idempotency_key: key });
  if (error) {
    userMessage(error, "anular pago");
    redirect(`/suscripciones/${subscriptionId}?error=1#historial`);
  }
  revalidatePath("/", "layout");
  redirect(`/suscripciones/${subscriptionId}?anulado=1#historial`);
}

export async function deleteSubscription(id: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/acceso");
  if (!uuid(id)) redirect("/suscripciones");
  const { error } = await session.supabase.from("subscriptions").delete().eq("id", id).eq("owner_id", session.userId);
  if (error) {
    userMessage(error, "borrar suscripción");
    redirect(`/suscripciones/${id}?error=1`);
  }
  revalidatePath("/", "layout");
  redirect("/suscripciones?borrada=1");
}
