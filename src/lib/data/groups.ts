import { isHue, type Hue } from "@/lib/catalog";
import { isMissingSchema } from "@/lib/errors";
import { isCurrency, type Currency } from "@/lib/finance/money";
import type { MemberPaymentRow, MembershipRow } from "@/lib/subscriptions/collections";
import type { Session } from "./session";

export interface GroupMember {
  memberId: string;
  displayName: string;
  avatarHue: Hue;
  isGuest: boolean;
  role: "leader" | "member";
  isMe: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
}

export interface ReceivedInvitation {
  id: string;
  subscriptionName: string;
  leaderName: string;
  priceCents: number | null;
  currency: Currency;
  billingPeriod: "monthly" | "yearly";
  activeMembers: number;
  maxMembers: number | null;
  expiresAt: string;
}

export async function getGroupMembers(session: Session, subscriptionId: string): Promise<GroupMember[]> {
  const { data, error } = await session.supabase.rpc("get_group_members", { p_subscription_id: subscriptionId });
  if (error) {
    if (!isMissingSchema(error)) console.error("[grupo] miembros:", error);
    return [];
  }
  return ((data ?? []) as {
    member_id: string;
    display_name: string;
    avatar_hue: string;
    is_guest: boolean;
    role: string;
    is_me: boolean;
  }[]).map((row) => ({
    memberId: row.member_id,
    displayName: row.display_name,
    avatarHue: isHue(row.avatar_hue) ? row.avatar_hue : "verde",
    isGuest: row.is_guest,
    role: row.role === "leader" ? "leader" : "member",
    isMe: row.is_me,
  }));
}

/** Invitaciones pendientes de un grupo (solo las ve el líder, por RLS). */
export async function getGroupInvites(session: Session, subscriptionId: string): Promise<PendingInvite[]> {
  const { data, error } = await session.supabase
    .from("invitations")
    .select("id, email, expires_at")
    .eq("subscription_id", subscriptionId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at")
    .returns<{ id: string; email: string; expires_at: string }[]>();
  if (error) {
    if (!isMissingSchema(error)) console.error("[grupo] invitaciones:", error);
    return [];
  }
  return (data ?? []).map((row) => ({ id: row.id, email: row.email, expiresAt: row.expires_at }));
}

/** Invitaciones que ha recibido quien mira (por su email verificado). */
export async function getReceivedInvitations(session: Session): Promise<ReceivedInvitation[]> {
  const { data, error } = await session.supabase.rpc("my_pending_invitations");
  if (error) {
    if (!isMissingSchema(error)) console.error("[invitaciones] recibidas:", error);
    return [];
  }
  return ((data ?? []) as {
    id: string;
    subscription_name: string;
    leader_name: string;
    price_cents: number | string | null;
    currency: string;
    billing_period: string;
    active_members: number;
    max_members: number | null;
    expires_at: string;
  }[]).map((row) => ({
    id: row.id,
    subscriptionName: row.subscription_name,
    leaderName: row.leader_name,
    priceCents: row.price_cents === null ? null : Number(row.price_cents),
    currency: isCurrency(row.currency) ? row.currency : "EUR",
    billingPeriod: row.billing_period === "yearly" ? "yearly" : "monthly",
    activeMembers: row.active_members,
    maxMembers: row.max_members,
    expiresAt: row.expires_at,
  }));
}

/** Participaciones (también las de quien ya salió), para calcular el reparto de cada fecha. */
export async function getMemberships(session: Session, subscriptionId: string): Promise<MembershipRow[]> {
  const { data, error } = await session.supabase
    .from("subscription_members")
    .select("id, role, joined_on, left_on")
    .eq("subscription_id", subscriptionId)
    .returns<{ id: string; role: string; joined_on: string; left_on: string | null }[]>();
  if (error) {
    if (!isMissingSchema(error)) console.error("[grupo] participaciones:", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role === "leader" ? "leader" : "member",
    joinedOn: row.joined_on,
    leftOn: row.left_on,
  }));
}

export type PaymentsResult = { status: "ok"; data: MemberPaymentRow[] } | { status: "setup" };

/** Pagos de los miembros. Por RLS, el líder ve todos y un miembro solo los suyos. */
export async function getMemberPayments(session: Session, subscriptionId: string): Promise<PaymentsResult> {
  const { data, error } = await session.supabase
    .from("member_payments")
    .select("id, member_id, renewal_date, periods, amount_cents, paid_on, status, note")
    .eq("subscription_id", subscriptionId)
    .order("created_at")
    .returns<
      {
        id: string;
        member_id: string;
        renewal_date: string;
        periods: number | null;
        amount_cents: number | string;
        paid_on: string;
        status: string;
        note: string | null;
      }[]
    >();
  if (error) {
    if (isMissingSchema(error)) return { status: "setup" };
    console.error("[grupo] cobros:", error);
    return { status: "ok", data: [] };
  }
  const statuses = ["declared", "confirmed", "rejected", "voided"] as const;
  return {
    status: "ok",
    data: (data ?? []).map((row) => ({
      id: row.id,
      memberId: row.member_id,
      renewalDate: row.renewal_date,
      periods: row.periods ?? 1,
      amountCents: Number(row.amount_cents),
      paidOn: row.paid_on,
      status: statuses.find((status) => status === row.status) ?? "declared",
      note: row.note,
    })),
  };
}

export interface PendingConfirmation {
  id: string;
  subscriptionId: string;
  subscriptionTitle: string;
  memberName: string;
  renewalDate: string;
  periods: number;
  amountCents: number;
  currency: Currency;
  billingPeriod: "monthly" | "yearly";
  paidOn: string;
  note: string | null;
}

/**
 * Pagos que te han declarado en los planes que pagas tú y esperan que los
 * confirmes. Por RLS solo se leen los de tus grupos (y los tuyos como miembro,
 * que aquí se descartan al filtrar por propietario).
 */
export async function getPendingConfirmations(session: Session, subscriptionId?: string): Promise<PendingConfirmation[]> {
  let query = session.supabase
    .from("member_payments")
    .select(
      "id, subscription_id, member_id, renewal_date, periods, amount_cents, paid_on, note, subscriptions!inner ( name, nickname, currency, billing_period, owner_id )",
    )
    .eq("status", "declared")
    .eq("subscriptions.owner_id", session.userId)
    .order("created_at");
  if (subscriptionId) query = query.eq("subscription_id", subscriptionId);
  const { data, error } = await query.returns<
    {
      id: string;
      subscription_id: string;
      member_id: string;
      renewal_date: string;
      periods: number | null;
      amount_cents: number | string;
      paid_on: string;
      note: string | null;
      subscriptions: { name: string; nickname: string | null; currency: string; billing_period: string; owner_id: string };
    }[]
  >();
  if (error) {
    if (!isMissingSchema(error)) console.error("[cobros] por confirmar:", error);
    return [];
  }
  const rows = data ?? [];
  // Nombres de quien declaró, grupo a grupo (normalmente son pocos).
  const names = new Map<string, string>();
  for (const id of new Set(rows.map((row) => row.subscription_id))) {
    for (const member of await getGroupMembers(session, id)) names.set(member.memberId, member.displayName);
  }
  return rows.map((row) => ({
    id: row.id,
    subscriptionId: row.subscription_id,
    subscriptionTitle: row.subscriptions.nickname?.trim() || row.subscriptions.name,
    memberName: names.get(row.member_id) ?? "Alguien",
    renewalDate: row.renewal_date,
    periods: row.periods ?? 1,
    amountCents: Number(row.amount_cents),
    currency: isCurrency(row.subscriptions.currency) ? row.subscriptions.currency : "EUR",
    billingPeriod: row.subscriptions.billing_period === "yearly" ? "yearly" : "monthly",
    paidOn: row.paid_on,
    note: row.note,
  }));
}

export interface ReceivedReminder {
  id: string;
  subscriptionId: string;
  subscriptionTitle: string;
  memberId: string;
  leaderName: string;
  renewalDate: string;
  amountCents: number;
  currency: Currency;
  billingPeriod: "monthly" | "yearly";
}

/** Recordatorios de pago que te han enviado y no has cerrado. */
export async function getReceivedReminders(session: Session): Promise<ReceivedReminder[]> {
  const { data, error } = await session.supabase
    .from("payment_reminders")
    .select(
      "id, subscription_id, member_id, renewal_date, amount_cents, subscription_members!inner ( user_id ), subscriptions!inner ( name, nickname, currency, billing_period )",
    )
    .is("dismissed_at", null)
    .eq("subscription_members.user_id", session.userId)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        subscription_id: string;
        member_id: string;
        renewal_date: string;
        amount_cents: number | string;
        subscriptions: { name: string; nickname: string | null; currency: string; billing_period: string };
      }[]
    >();
  if (error) {
    if (!isMissingSchema(error)) console.error("[recordatorios] recibidos:", error);
    return [];
  }
  const rows = data ?? [];
  const leaders = new Map<string, string>();
  for (const id of new Set(rows.map((row) => row.subscription_id))) {
    const leader = (await getGroupMembers(session, id)).find((member) => member.role === "leader");
    if (leader) leaders.set(id, leader.displayName);
  }
  return rows.map((row) => ({
    id: row.id,
    subscriptionId: row.subscription_id,
    subscriptionTitle: row.subscriptions.nickname?.trim() || row.subscriptions.name,
    memberId: row.member_id,
    leaderName: leaders.get(row.subscription_id) ?? "Quien paga el plan",
    renewalDate: row.renewal_date,
    amountCents: Number(row.amount_cents),
    currency: isCurrency(row.subscriptions.currency) ? row.subscriptions.currency : "EUR",
    billingPeriod: row.subscriptions.billing_period === "yearly" ? "yearly" : "monthly",
  }));
}
