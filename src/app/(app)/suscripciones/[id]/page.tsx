import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSubscription, voidPayment } from "@/app/(app)/suscripciones/actions";
import { LoadProblem } from "@/components/app/LoadProblem";
import { ShareForm } from "@/components/groups/GroupForms";
import { CollectionsPanel } from "@/components/groups/CollectionsPanel";
import { PeoplePanel } from "@/components/groups/PeoplePanel";
import { ShareDonut } from "@/components/groups/ShareDonut";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { PaymentForm, PriceForm } from "@/components/subscriptions/SubscriptionForms";
import { StatusPill } from "@/components/subscriptions/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { ServiceMark } from "@/components/ui/ServiceMark";
import { CATEGORIES } from "@/lib/catalog";
import { getCatalog } from "@/lib/data/catalog";
import { getGroupInvites, getGroupMembers, getMemberPayments, getMemberships, type GroupMember } from "@/lib/data/groups";
import { getProfile } from "@/lib/data/profile";
import { requireSession } from "@/lib/data/session";
import { getSubscription } from "@/lib/data/subscriptions";
import { addMonths, daysBetween, formatDay } from "@/lib/finance/dates";
import { centsToInput, formatMoney, monthlyEquivalent } from "@/lib/finance/money";
import {
  PERIOD_LABEL,
  forecasts,
  isRunning,
  isVoided,
  latestPrice,
  missingRenewals,
  myShareOf,
  nextRenewal,
  priceOn,
  totalPaid,
  type PersonalSubscription,
} from "@/lib/subscriptions/personal";
import { relativeDays, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Suscripción · NacoArt3D" };

const NOTICES: Record<string, { tone: "success" | "error"; text: string }> = {
  creada: { tone: "success", text: "Suscripción guardada." },
  guardada: { tone: "success", text: "Cambios guardados." },
  pago: { tone: "success", text: "Pago anotado." },
  anulado: { tone: "success", text: "Pago anulado. Queda en el historial como anulado." },
  unido: { tone: "success", text: "Ya formas parte del grupo." },
  revocada: { tone: "success", text: "Invitación anulada. La plaza vuelve a estar libre." },
  quitado: { tone: "success", text: "Esa persona ya no forma parte del grupo." },
  cobro: { tone: "success", text: "Pago anotado." },
  confirmado: { tone: "success", text: "Pago confirmado." },
  rechazado: { tone: "success", text: "Pago rechazado. Sigue pendiente." },
  cobroAnulado: { tone: "success", text: "Cobro anulado. Queda en el historial como anulado." },
  error: { tone: "error", text: "No hemos podido completar la operación. Inténtalo de nuevo." },
};

export default async function SubscriptionPage(props: PageProps<"/suscripciones/[id]">) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const session = await requireSession();
  const profile = await getProfile(session);
  const today = todayIn(profile.timezone);
  const result = await getSubscription(session, id);
  if (result.status !== "ok") return <LoadProblem status={result.status} retryHref={`/suscripciones/${id}`} />;
  const sub = result.data;
  if (!sub) notFound();

  const noticeKey = Object.keys(NOTICES).find((key) => params[key]);
  const notice = noticeKey ? NOTICES[noticeKey] : null;
  const requestedRenewal = typeof params.renovacion === "string" ? params.renovacion : "";
  const isMember = sub.role === "member";
  const shared = sub.mode === "shared";
  const [members, invites, catalog, memberships, payments] = await Promise.all([
    shared ? getGroupMembers(session, sub.id) : Promise.resolve([]),
    shared && !isMember ? getGroupInvites(session, sub.id) : Promise.resolve([]),
    !shared && sub.planId ? getCatalog(session) : Promise.resolve([]),
    shared ? getMemberships(session, sub.id) : Promise.resolve([]),
    shared ? getMemberPayments(session, sub.id) : Promise.resolve({ status: "ok" as const, data: [] }),
  ]);
  const collectionsPanel = shared ? (
    <CollectionsPanel
      sub={sub}
      members={members}
      memberships={memberships}
      payments={payments.status === "ok" ? payments.data : []}
      today={today}
      setupMissing={payments.status === "setup"}
    />
  ) : null;
  const plan = catalog.flatMap((service) => service.plans).find((item) => item.id === sub.planId) ?? null;
  // Se puede compartir si es personalizada, o si el plan admite más de una persona (o no se sabe).
  const canShare = !shared && sub.participation !== "member" && (plan === null || plan.maxMembers === null || plan.maxMembers >= 2);

  return (
    <>
      <Link href="/suscripciones" className="inline-flex items-center gap-1 rounded-full text-small text-muted hover:text-ink">
        <Icon name="back" /> Suscripciones
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ServiceMark name={sub.name} category={sub.categoryId} size="lg" />
          <div className="min-w-0">
            <h1 className="text-title font-semibold break-words">{sub.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-muted">
              <StatusPill status={sub.status} />
              {shared ? (
                <Pill tone="accent" icon="users">
                  {isMember ? "Compartida contigo" : "Compartida"}
                </Pill>
              ) : null}
              {CATEGORIES[sub.categoryId].name} · {PERIOD_LABEL[sub.billingPeriod]}
            </p>
          </div>
        </div>
        {isMember ? null : (
          <ButtonLink href={`/suscripciones/${sub.id}/editar`} icon="pencil">
            Editar
          </ButtonLink>
        )}
      </header>

      {notice ? (
        <p
          role="status"
          className={`mt-6 flex items-center gap-2 rounded-inner px-4 py-3 text-small ${
            notice.tone === "success" ? "bg-positive-soft text-positive-ink" : "bg-negative-soft text-negative-ink"
          }`}
        >
          <Icon name={notice.tone === "success" ? "check" : "alert"} /> {notice.text}
        </p>
      ) : null}

      {isMember ? (
        <>
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Overview sub={sub} today={today} members={members} />
            {collectionsPanel}
          </div>
          <div className="mt-6">
            <PeoplePanel sub={sub} members={members} invites={[]} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Overview sub={sub} today={today} members={members} />
            <div className="flex flex-col gap-6">
              {canShare ? <ShareCard sub={sub} verifiedMax={plan?.maxMembers && plan.maxMembers >= 2 ? plan.maxMembers : null} /> : null}
              <History sub={sub} />
            </div>
          </div>
          {shared ? (
            <div className="mt-6">
              <PeoplePanel sub={sub} members={members} invites={invites} />
            </div>
          ) : null}
          {collectionsPanel ? <div className="mt-6">{collectionsPanel}</div> : null}
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <PaymentPanel sub={sub} today={today} requested={requestedRenewal} />
            <div className="flex flex-col gap-6">
              <PricePanel sub={sub} today={today} />
              <DangerZone sub={sub} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Overview({ sub, today, members }: { sub: PersonalSubscription; today: string; members: GroupMember[] }) {
  const price = priceOn(sub.prices, today);
  const next = nextRenewal(sub, today);
  const coming = forecasts(sub, today, addMonths(today, sub.billingPeriod === "monthly" ? 3 : 24)).slice(0, 3);
  return (
    <section aria-labelledby="resumen" className="rounded-card bg-surface p-6 sm:p-8">
      <h2 id="resumen" className="sr-only">
        Resumen
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <Money cents={price} currency={sub.currency} className="text-figure font-bold" />
        <span className="text-body text-muted">
          {sub.billingPeriod === "monthly" ? "al mes" : "al año"}
          {sub.mode === "shared" || sub.participation === "member" ? " en total" : ""}
        </span>
      </p>
      {sub.participation === "member" ? (
        <p className="mt-2 text-body">
          Tu parte: <Money cents={myShareOf(sub, price)} currency={sub.currency} className="font-semibold" />{" "}
          <span className="text-muted">
            {sub.billingPeriod === "monthly" ? "al mes" : "al año"}
            {sub.planOwnerName ? ` · lo paga ${sub.planOwnerName}` : " · lo paga otra persona"}
          </span>
        </p>
      ) : null}
      {sub.mode === "shared" && members.length > 0 ? (
        <div className="mt-6 rounded-inner bg-raised p-4 sm:p-5">
          <ShareDonut
            members={members}
            total={price}
            currency={sub.currency}
            period={sub.billingPeriod}
            showAllAmounts={sub.role === "leader"}
          />
        </div>
      ) : null}
      {sub.billingPeriod === "yearly" ? (
        <p className="text-small text-muted">
          Unos <Money cents={monthlyEquivalent(myShareOf(sub, price), "yearly")} currency={sub.currency} className="font-semibold text-ink" /> al
          mes equivalentes{sub.mode === "shared" ? " de tu parte" : ""}.
        </p>
      ) : null}

      <div className="mt-6 rounded-inner bg-raised p-4 sm:p-5">
        {next ? (
          <>
            <p className="text-small text-muted">Próxima renovación</p>
            <p className="text-body font-semibold">
              {formatDay(next, true)} <span className="font-normal text-muted">· {relativeDays(daysBetween(today, next))}</span>
            </p>
            {coming.length > 1 ? (
              <p className="mt-2 text-small text-muted">
                Después: {coming.slice(1).map((row) => formatDay(row.date, true)).join(" y ")}.
              </p>
            ) : null}
            <p className="mt-2 text-[0.8125rem] text-muted">Es una previsión: solo cuenta como pago cuando lo anotas.</p>
          </>
        ) : sub.status === "cancelled" ? (
          <p className="text-small">
            Cancelada el {sub.cancelledOn ? formatDay(sub.cancelledOn, true) : "—"}.
            {sub.paidThroughDate ? ` Sigue pagada hasta el ${formatDay(sub.paidThroughDate, true)}.` : ""}
          </p>
        ) : (
          <p className="text-small">Está pausada: no prevemos renovaciones hasta que la reactives.</p>
        )}
      </div>

      {sub.manageUrl || sub.notes ? (
        <div className="mt-6 flex flex-col gap-3 text-small">
          {sub.manageUrl ? (
            <a
              href={sub.manageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-accent-ink hover:underline"
            >
              <Icon name="external" /> Gestionar en la web del servicio
            </a>
          ) : null}
          {sub.notes ? <p className="whitespace-pre-line text-muted">{sub.notes}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function PaymentPanel({ sub, today, requested }: { sub: PersonalSubscription; today: string; requested: string }) {
  const missing = missingRenewals(sub, today);
  const todayRenewal = forecasts(sub, today, today).filter((row) => !row.paid);
  const options = [...todayRenewal, ...missing].map((row) => ({
    value: row.date,
    label: `${formatDay(row.date, true)} · ${formatMoney(row.amount, sub.currency)}${row.date === today ? " (hoy)" : ""}`,
    amount: centsToInput(row.amount),
  }));
  const defaultRenewal = options.some((row) => row.value === requested) ? requested : (options[0]?.value ?? "");
  return (
    <Panel
      title="Anotar un pago"
      titleId="registrar-pago"
      aside={missing.length > 0 ? <Pill tone="warning" icon="info">{missing.length === 1 ? "1 por anotar" : `${missing.length} por anotar`}</Pill> : null}
    >
      <div className="-mt-2 mb-5">
        <p className="text-small text-muted">
          {missing.length > 0
            ? "Hay renovaciones pasadas sin pago anotado. No es una deuda: solo falta apuntarlo."
            : "Apunta lo que te han cobrado para llevar la cuenta de lo pagado de verdad."}
        </p>
      </div>
      <PaymentForm
        id={sub.id}
        idempotencyKey={crypto.randomUUID()}
        today={today}
        defaultAmount={centsToInput(priceOn(sub.prices, today))}
        renewals={options}
        defaultRenewal={defaultRenewal}
      />
    </Panel>
  );
}

function History({ sub }: { sub: PersonalSubscription }) {
  const payments = sub.entries
    .filter((entry) => entry.kind === "personal_payment")
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : 0));
  const total = totalPaid(sub.entries);
  return (
    <Panel title="Historial de pagos" titleId="historial" aside={payments.length > 0 ? <>Total: <Money cents={total} currency={sub.currency} className="font-semibold text-ink" /></> : null}>
      {payments.length === 0 ? (
        <p className="rounded-inner bg-raised p-4 text-small text-muted">Todavía no has anotado ningún pago.</p>
      ) : (
        <ul className="flex flex-col">
          {payments.map((entry) => {
            const voided = isVoided(entry, sub.entries);
            return (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 border-b border-rule py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className={`text-small font-semibold ${voided ? "text-muted line-through" : ""}`}>{formatDay(entry.occurredOn, true)}</p>
                  <p className="text-[0.8125rem] text-muted">
                    {entry.renewalDate ? `Renovación del ${formatDay(entry.renewalDate, true)}` : "Pago suelto"}
                    {entry.concept ? ` · ${entry.concept}` : ""}
                  </p>
                </div>
                <Money cents={entry.amountCents} currency={sub.currency} className={`text-small font-semibold ${voided ? "text-muted line-through" : ""}`} />
                {voided ? (
                  <Pill tone="outline" icon="close">
                    Anulado
                  </Pill>
                ) : (
                  <details className="group">
                    <summary className="cursor-pointer list-none rounded-full px-2 py-1 text-[0.8125rem] font-medium text-muted hover:bg-active hover:text-ink [&::-webkit-details-marker]:hidden">
                      Anular
                    </summary>
                    <form action={voidPayment.bind(null, sub.id, entry.id)} className="mt-2 flex flex-col items-end gap-2">
                      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                      <p className="max-w-56 text-right text-[0.8125rem] text-muted">Quedará en el historial marcado como anulado.</p>
                      <SubmitButton variant="danger" pendingLabel="Anulando…">
                        Sí, anular
                      </SubmitButton>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function PricePanel({ sub, today }: { sub: PersonalSubscription; today: string }) {
  const prices = [...sub.prices].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  const latest = latestPrice(sub.prices);
  return (
    <Panel title="Precio" titleId="precio">
      <ul className="flex flex-col">
        {prices.map((price) => (
          <li key={price.effectiveFrom} className="flex items-center justify-between gap-3 border-b border-rule py-2.5 text-small last:border-b-0">
            <span className="text-muted">Desde el {formatDay(price.effectiveFrom, true)}</span>
            <Money cents={price.amountCents} currency={sub.currency} className="font-semibold" />
          </li>
        ))}
      </ul>
      {isRunning(sub) ? (
        <details className="mt-4 rounded-inner bg-raised">
          <summary className="cursor-pointer rounded-inner px-4 py-3 text-small font-semibold">¿Te han cambiado el precio?</summary>
          <div className="px-4 pb-4">
            <p className="mb-4 text-small text-muted">El nuevo precio aplica desde la fecha que elijas. Lo anterior no cambia.</p>
            <PriceForm id={sub.id} today={today} currentAmount={latest ? centsToInput(latest.amountCents) : ""} />
          </div>
        </details>
      ) : null}
    </Panel>
  );
}

function ShareCard({ sub, verifiedMax }: { sub: PersonalSubscription; verifiedMax: number | null }) {
  return (
    <details className="group rounded-card bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-card p-6 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <Icon name="users" size="lg" className="text-accent-ink" />
          <span>
            <span className="block text-body font-semibold">¿La compartes con alguien?</span>
            <span className="block text-small text-muted">Conviértela en un plan compartido y reparte el coste.</span>
          </span>
        </span>
        <Icon name="chevron" className="transition-transform duration-150 group-open:rotate-90" />
      </summary>
      <div className="px-6 pb-6">
        <ShareForm subscriptionId={sub.id} verifiedMax={verifiedMax} />
      </div>
    </details>
  );
}

function DangerZone({ sub }: { sub: PersonalSubscription }) {
  return (
    <details className="rounded-card border border-border">
      <summary className="cursor-pointer rounded-card px-6 py-4 text-small font-semibold text-muted">Borrar suscripción</summary>
      <form action={deleteSubscription.bind(null, sub.id)} className="flex flex-col items-start gap-3 px-6 pb-6">
        <p className="text-small text-muted">
          Se borrarán la suscripción, su historial de precios y todos sus pagos anotados
          {sub.mode === "shared" ? ", y desaparecerá para todas las personas del grupo" : ""}. No se puede deshacer. Si
          ya no la pagas, quizá prefieras marcarla como cancelada.
        </p>
        <SubmitButton variant="danger" icon="trash" pendingLabel="Borrando…">
          Borrar «{sub.name}»
        </SubmitButton>
      </form>
    </details>
  );
}
