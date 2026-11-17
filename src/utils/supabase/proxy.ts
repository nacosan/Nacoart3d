import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

const CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

/**
 * Refresca la sesión de Supabase en cada petición y propaga las cookies
 * actualizadas tanto a la petición (para los Server Components) como a la
 * respuesta (para el navegador).
 *
 * Devuelve SIEMPRE la respuesta que generó este helper, o una nueva a la que
 * se hayan copiado sus cookies con `withSupabaseCookies`; si no, el usuario
 * pierde la sesión en la siguiente petición.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        // Evita que una CDN cachee una respuesta con cookies de sesión.
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  // No pongas código entre createServerClient y getClaims().
  // getClaims() valida el JWT y refresca el token si ha caducado.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  return { response: supabaseResponse, claims };
}

/**
 * Copia las cookies y cabeceras de caché de Supabase a otra respuesta
 * (por ejemplo, una redirección) para no perder la sesión refrescada.
 */
export function withSupabaseCookies<T extends NextResponse>(
  target: T,
  supabaseResponse: NextResponse,
): T {
  supabaseResponse.cookies
    .getAll()
    .forEach((cookie) => target.cookies.set(cookie));
  for (const header of CACHE_HEADERS) {
    const value = supabaseResponse.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}
