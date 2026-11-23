import { cache } from "react";
import { isHue, type Hue } from "@/lib/catalog";
import { isCurrency, type Cents, type Currency } from "@/lib/finance/money";
import { isMissingSchema } from "@/lib/errors";
import type { Session } from "./session";

export interface Profile {
  displayName: string;
  avatarHue: Hue;
  currency: Currency;
  timezone: string;
  monthlyBudgetCents: Cents | null;
  /** false si la tabla de perfiles todavía no existe (migración sin aplicar). */
  stored: boolean;
}

interface ProfileRow {
  display_name: string;
  avatar_hue: string;
  currency: string;
  timezone: string;
  monthly_budget_cents: number | null;
}

function fallback(session: Session): Profile {
  return {
    displayName: session.email?.split("@")[0] || "Tú",
    avatarHue: "azul",
    currency: "EUR",
    timezone: "Europe/Madrid",
    monthlyBudgetCents: null,
    stored: false,
  };
}

export const getProfile = cache(async (session: Session): Promise<Profile> => {
  const { data, error } = await session.supabase
    .from("profiles")
    .select("display_name, avatar_hue, currency, timezone, monthly_budget_cents")
    .eq("id", session.userId)
    .maybeSingle<ProfileRow>();
  if (error) {
    if (!isMissingSchema(error)) console.error("[perfil] lectura:", error);
    return fallback(session);
  }
  if (!data) return fallback(session);
  return {
    displayName: data.display_name,
    avatarHue: isHue(data.avatar_hue) ? data.avatar_hue : "azul",
    currency: isCurrency(data.currency) ? data.currency : "EUR",
    timezone: data.timezone,
    monthlyBudgetCents: data.monthly_budget_cents === null ? null : Number(data.monthly_budget_cents),
    stored: true,
  };
});

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toLocaleUpperCase("es-ES");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
