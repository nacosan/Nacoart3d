import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

export interface Session {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
}

/** Sesión validada con getClaims() (verifica el JWT). Una vez por petición. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, userId: data.claims.sub, email };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/acceso");
  return session;
}
