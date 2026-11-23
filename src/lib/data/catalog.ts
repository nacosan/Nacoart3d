import { cache } from "react";
import { isCategoryId, type CategoryId } from "@/lib/catalog";
import { isMissingSchema } from "@/lib/errors";
import { isCurrency, type Currency } from "@/lib/finance/money";
import type { Session } from "./session";

export interface CatalogPlan {
  id: string;
  name: string;
  billingPeriod: "monthly" | "yearly";
  /** null: precio no verificado. */
  priceCents: number | null;
  currency: Currency;
  /** Personas que pueden usarlo, titular incluido. null: desconocido. */
  maxMembers: number | null;
  isFamily: boolean;
  conditions: string | null;
  sourceUrl: string | null;
  verifiedOn: string | null;
}

export interface CatalogService {
  id: string;
  name: string;
  categoryId: CategoryId;
  website: string | null;
  plans: CatalogPlan[];
}

interface ServiceRow {
  id: string;
  name: string;
  category_id: string;
  website: string | null;
  sort_order: number;
  plans: {
    id: string;
    name: string;
    billing_period: string;
    price_cents: number | string | null;
    currency: string;
    max_members: number | null;
    is_family: boolean;
    conditions: string | null;
    source_url: string | null;
    verified_on: string | null;
    sort_order: number;
  }[];
}

/** Catálogo de servicios y planes. Vacío si la migración aún no existe. */
export const getCatalog = cache(async (session: Session): Promise<CatalogService[]> => {
  const { data, error } = await session.supabase
    .from("services")
    .select(
      "id, name, category_id, website, sort_order, plans ( id, name, billing_period, price_cents, currency, max_members, is_family, conditions, source_url, verified_on, sort_order )",
    )
    .order("sort_order")
    .order("name")
    .returns<ServiceRow[]>();
  if (error) {
    if (!isMissingSchema(error)) console.error("[catálogo] lectura:", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: isCategoryId(row.category_id) ? row.category_id : "otros",
    website: row.website,
    plans: [...row.plans]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((plan) => ({
        id: plan.id,
        name: plan.name,
        billingPeriod: plan.billing_period === "yearly" ? "yearly" : "monthly",
        priceCents: plan.price_cents === null ? null : Number(plan.price_cents),
        currency: isCurrency(plan.currency) ? plan.currency : "EUR",
        maxMembers: plan.max_members,
        isFamily: plan.is_family,
        conditions: plan.conditions,
        sourceUrl: plan.source_url,
        verifiedOn: plan.verified_on,
      })),
  }));
});
