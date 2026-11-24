"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/molecules/FormState";
import { isHue } from "@/lib/catalog";
import { getSession } from "@/lib/data/session";
import { userMessage } from "@/lib/errors";
import { isCurrency, parseAmountToCents } from "@/lib/finance/money";
import { echo } from "@/lib/forms";
import { isTimezone } from "@/lib/time";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { tone: "error", message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  const values = echo(formData, ["displayName", "avatarHue", "currency", "timezone", "budget"]);
  const fieldErrors: Record<string, string> = {};
  if (values.displayName.length < 1 || values.displayName.length > 60) fieldErrors.displayName = "Escribe un nombre de hasta 60 caracteres.";
  if (!isHue(values.avatarHue)) fieldErrors.avatarHue = "Elige un color.";
  if (!isCurrency(values.currency)) fieldErrors.currency = "Elige una moneda.";
  if (!isTimezone(values.timezone)) fieldErrors.timezone = "Elige una zona horaria.";
  let budget: number | null = null;
  if (values.budget) {
    budget = parseAmountToCents(values.budget);
    if (budget === null || budget === 0) fieldErrors.budget = "Escribe un importe mayor que cero, o déjalo vacío.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const { error, count } = await session.supabase
    .from("profiles")
    .update(
      {
        display_name: values.displayName,
        avatar_hue: values.avatarHue,
        currency: values.currency,
        timezone: values.timezone,
        monthly_budget_cents: budget,
      },
      { count: "exact" },
    )
    .eq("id", session.userId);
  if (error) return { tone: "error", message: userMessage(error, "perfil"), values };
  if (count === 0) return { tone: "error", message: "No encontramos tu perfil. Cierra sesión y vuelve a entrar.", values };

  revalidatePath("/", "layout");
  return { tone: "success", message: "Ajustes guardados.", values };
}
