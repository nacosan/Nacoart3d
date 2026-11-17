import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Crea uno nuevo en cada petición; no lo guardes en una variable global.
 *
 * Para autorizar en el servidor usa `supabase.auth.getClaims()`,
 * no `getSession()`: getSession() no valida el JWT.
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Los Server Components no pueden escribir cookies. Se ignora porque
          // src/proxy.ts refresca la sesión y escribe las cookies en cada petición.
        }
      },
    },
  });
}
