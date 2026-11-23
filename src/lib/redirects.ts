import { NextResponse, type NextRequest } from "next/server";
import { codespaceOrigin } from "./codespace";

/** Solo rutas internas: evita redirecciones abiertas a otros dominios. */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/**
 * Redirección con una ruta relativa en Location. Detrás de un proxy (por
 * ejemplo, Codespaces) request.url puede apuntar a localhost; una ruta
 * relativa siempre vuelve al mismo origen que ve el navegador.
 */
export function relativeRedirect(path: string, status: 303 | 307 = 307): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path } });
}

/**
 * URL absoluta en el origen que ve el navegador. El proxy de Next exige URL
 * absolutas; detrás de Codespaces el host real llega en x-forwarded-host.
 */
export function publicUrl(request: NextRequest, path: string): URL {
  const host = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto");
  const base = codespaceOrigin() ?? (host ? `${proto ?? "https"}://${host}` : request.nextUrl.origin);
  return new URL(path, base);
}
