import { headers } from "next/headers";
import { codespaceOrigin } from "./codespace";

/**
 * Origen público de la petición (sirve también detrás del proxy de Codespaces).
 * Se usa para los enlaces de los correos de Supabase; la URL tiene que estar en
 * Authentication > URL Configuration > Redirect URLs.
 */
export async function requestOrigin(): Promise<string> {
  const codespace = codespaceOrigin();
  if (codespace) return codespace;
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
