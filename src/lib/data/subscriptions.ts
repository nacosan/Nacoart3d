import { isCategoryId } from "@/lib/catalog";
import { isCurrency } from "@/lib/finance/money";
import { isMissingSchema } from "@/lib/errors";
import type { LedgerRow, PersonalSubscription, SubscriptionStatus } from "@/lib/subscriptions/personal";
import type { Session } from "./session";

const SELECT = `
  id, owner_id, mode, plan_id, max_members, participation, my_share_cents, plan_owner_name, nickname, name, category_id, currency, billing_period, renewal_anchor, status,
  cancelled_on, paid_through_date, manage_url, notes, tracking_from,
  subscription_prices ( amount_cents, effective_from ),
  ledger_entries ( id, kind, amount_cents, occurred_on, renewal_date, voids_entry_id, concept, periods ),
  subscription_members ( user_id, role, status )
`;

interface SubscriptionRow {
  id: string;
  owner_id: string;
  mode: string;
  plan_id: string | null;
  max_members: number | null;
  participation: string;
  my_share_cents: number | string | null;
  plan_owner_name: string | null;
  nickname: string | null;
  subscription_members: { user_id: string | null; role: string; status: string }[] | null;
  name: string;
  category_id: string;
  currency: string;
  billing_period: string;
  renewal_anchor: string;
  status: string;
  cancelled_on: string | null;
  paid_through_date: string | null;
  manage_url: string | null;
  notes: string | null;
  tracking_from: string;
  subscription_prices: { amount_cents: number | string; effective_from: string }[] | null;
  ledger_entries:
    | {
        id: string;
        kind: string;
        amount_cents: number | string;
        occurred_on: string;
        renewal_date: string | null;
        voids_entry_id: string | null;
        concept: string | null;
        periods?: number | null;
      }[]
    | null;
}

const STATUSES: readonly SubscriptionStatus[] = ["active", "trial", "paused", "cancelled"];

function toModel(row: SubscriptionRow, viewerId: string): PersonalSubscription {
  const active = (row.subscription_members ?? []).filter((member) => member.status === "active");
  const shared = row.mode === "shared";
  return {
    mode: shared ? "shared" : "personal",
    planId: row.plan_id,
    maxMembers: row.max_members,
    role: !shared ? "owner" : row.owner_id === viewerId ? "leader" : "member",
    activeMembers: shared ? Math.max(1, active.length) : 1,
    participation: row.participation === "member" ? "member" : "owner",
    myShareCents: row.my_share_cents === null ? null : Number(row.my_share_cents),
    planOwnerName: row.plan_owner_name,
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    categoryId: isCategoryId(row.category_id) ? row.category_id : "otros",
    currency: isCurrency(row.currency) ? row.currency : "EUR",
    billingPeriod: row.billing_period === "yearly" ? "yearly" : "monthly",
    renewalAnchor: row.renewal_anchor,
    status: (STATUSES as readonly string[]).includes(row.status) ? (row.status as SubscriptionStatus) : "active",
    cancelledOn: row.cancelled_on,
    paidThroughDate: row.paid_through_date,
    manageUrl: row.manage_url,
    notes: row.notes,
    trackingFrom: row.tracking_from,
    // bigint llega como número (o texto si es muy grande); los importes caben en un entero seguro.
    prices: (row.subscription_prices ?? []).map((price) => ({
      amountCents: Number(price.amount_cents),
      effectiveFrom: price.effective_from,
    })),
    entries: (row.ledger_entries ?? []).map(
      (entry): LedgerRow => ({
        id: entry.id,
        kind: entry.kind === "void" ? "void" : "personal_payment",
        amountCents: Number(entry.amount_cents),
        occurredOn: entry.occurred_on,
        renewalDate: entry.renewal_date,
        voidsEntryId: entry.voids_entry_id,
        concept: entry.concept,
        periods: entry.periods ?? 1,
      }),
    ),
  };
}

export type LoadResult<T> = { status: "ok"; data: T } | { status: "setup" } | { status: "error" };

export async function listSubscriptions(session: Session): Promise<LoadResult<PersonalSubscription[]>> {
  const { data, error } = await session.supabase
    .from("subscriptions")
    .select(SELECT)
    // Sin filtro por propietario: la RLS devuelve las propias y los grupos en los que participa.
    .order("name", { ascending: true })
    .returns<SubscriptionRow[]>();
  if (error) {
    if (isMissingSchema(error)) return { status: "setup" };
    console.error("[suscripciones] listado:", error);
    return { status: "error" };
  }
  return { status: "ok", data: (data ?? []).map((row) => toModel(row, session.userId)) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export async function getSubscription(session: Session, id: string): Promise<LoadResult<PersonalSubscription | null>> {
  if (!isUuid(id)) return { status: "ok", data: null };
  const { data, error } = await session.supabase
    .from("subscriptions")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle<SubscriptionRow>();
  if (error) {
    if (isMissingSchema(error)) return { status: "setup" };
    console.error("[suscripciones] detalle:", error);
    return { status: "error" };
  }
  return { status: "ok", data: data ? toModel(data, session.userId) : null };
}
