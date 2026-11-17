type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

/**
 * Lee la configuración pública de Supabase.
 *
 * Las variables NEXT_PUBLIC_* se referencian de forma literal para que Next.js
 * pueda incrustarlas en el bundle del navegador. Si falta alguna, el error
 * indica su nombre pero nunca su valor.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !publishableKey) {
    throw new Error(
      `Faltan variables de entorno de Supabase: ${missing.join(", ")}. ` +
        "Copia .env.example a .env.local y reinicia el servidor de desarrollo.",
    );
  }

  return { url, publishableKey };
}
