import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { relativeRedirect, safeNext } from "@/lib/redirects";
import { createClient } from "@/utils/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Enlaces de los correos de Supabase (confirmación y recuperación).
 * Admite las dos formas:
 *   - ?token_hash=…&type=… (plantilla con {{ .TokenHash }}; funciona en cualquier navegador);
 *   - ?code=… (plantilla por defecto con flujo PKCE; mismo navegador en que se pidió).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("siguiente") ?? searchParams.get("next"), type === "recovery" ? "/restablecer" : "/");

  const supabase = await createClient();
  let failed = true;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) console.error("[auth] verificación del enlace:", error);
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[auth] intercambio de código:", error);
    failed = Boolean(error);
  }

  return relativeRedirect(failed ? "/acceso?enlace=caducado" : next);
}
