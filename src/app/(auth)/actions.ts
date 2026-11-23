"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms/FormState";
import { requestOrigin } from "@/lib/origin";
import { safeNext } from "@/lib/redirects";
import { createClient } from "@/utils/supabase/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function authError(error: { code?: string; status?: number; message?: string }, context: string): string {
  console.error(`[auth] ${context}:`, error);
  switch (error.code) {
    case "invalid_credentials":
      return "El email o la contraseña no son correctos.";
    case "email_not_confirmed":
      return "Todavía no has confirmado tu email. Revisa tu bandeja de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Ya hay una cuenta con ese email. Prueba a iniciar sesión.";
    case "weak_password":
      return "La contraseña es demasiado débil. Usa al menos 8 caracteres y mezcla letras y números.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Has hecho demasiados intentos seguidos. Espera unos minutos y vuelve a probar.";
    case "same_password":
      return "La nueva contraseña tiene que ser distinta de la anterior.";
    default:
      return "No hemos podido completar la operación. Inténtalo de nuevo en un momento.";
  }
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email");
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";
  const values = { email };
  const fieldErrors: Record<string, string> = {};
  if (!EMAIL.test(email)) fieldErrors.email = "Escribe un email válido.";
  if (!password) fieldErrors.password = "Escribe tu contraseña.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { message: authError(error, "inicio de sesión"), tone: "error", values };
  redirect(safeNext(formData.get("siguiente")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  const email = text(formData, "email");
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";
  const values = { name, email };
  const fieldErrors: Record<string, string> = {};
  if (name.length < 1 || name.length > 60) fieldErrors.name = "Escribe cómo quieres que te llamemos (hasta 60 caracteres).";
  if (!EMAIL.test(email)) fieldErrors.email = "Escribe un email válido.";
  if (password.length < MIN_PASSWORD) fieldErrors.password = `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`;
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name },
      emailRedirectTo: `${origin}/auth/confirm?siguiente=/`,
    },
  });
  if (error) return { message: authError(error, "registro"), tone: "error", values };
  // Si la confirmación por email está desactivada, ya hay sesión.
  if (data.session) redirect("/");
  return {
    tone: "success",
    message: `Te hemos enviado un email a ${email}. Abre el enlace para activar tu cuenta.`,
    values,
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email");
  if (!EMAIL.test(email)) return { fieldErrors: { email: "Escribe un email válido." }, values: { email } };
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?siguiente=/restablecer`,
  });
  if (error && error.code !== "user_not_found") {
    return { message: authError(error, "recuperación"), tone: "error", values: { email } };
  }
  // Mismo mensaje exista o no la cuenta, para no revelar qué emails están registrados.
  return {
    tone: "success",
    message: "Si hay una cuenta con ese email, te llegará un enlace para elegir una contraseña nueva.",
    values: { email },
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";
  const confirm = typeof formData.get("confirm") === "string" ? (formData.get("confirm") as string) : "";
  const fieldErrors: Record<string, string> = {};
  if (password.length < MIN_PASSWORD) fieldErrors.password = `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`;
  else if (password !== confirm) fieldErrors.confirm = "Las dos contraseñas no coinciden.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { tone: "error", message: "El enlace ha caducado. Pide uno nuevo desde «He olvidado mi contraseña»." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: authError(error, "nueva contraseña"), tone: "error" };
  return { tone: "success", message: "Listo, tu contraseña se ha cambiado." };
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[auth] cierre de sesión:", error);
  redirect("/acceso");
}
