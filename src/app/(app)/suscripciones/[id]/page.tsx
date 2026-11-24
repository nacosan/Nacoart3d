import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSubscription, voidPayment } from "@/app/(app)/suscripciones/actions";
import { LoadProblem } from "@/components/molecules/LoadProblem";
import { ShareForm } from "@/components/organisms/groups/GroupForms";
import { CollectedPaymentsHistory, CollectionForm, CollectionsPanel, payableMembers } from "@/components/organisms/groups/CollectionsPanel";
import { PeoplePanel } from "@/components/organisms/groups/PeoplePanel";
import { PendingConfirmations } from "@/components/organisms/groups/PendingConfirmations";
import { ShareBar, memberColors } from "@/components/organisms/groups/ShareBar";
import { SubmitButton } from "@/components/molecules/SubmitButton";
import { PaymentCalendar, type CalendarRow } from "@/components/organisms/subscriptions/PaymentCalendar";
import { PaymentKindSwitch } from "@/components/organisms/subscriptions/PaymentKindSwitch";
import { SectionActions, type Section } from "@/components/organisms/subscriptions/SectionActions";
import { PaymentForm, PriceForm } from "@/components/organisms/subscriptions/SubscriptionForms";
import { StatusPill } from "@/components/molecules/StatusPill";
import { ButtonLink } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Money } from "@/components/atoms/Money";
import { Panel } from "@/components/molecules/Panel";
import { Pill } from "@/components/atoms/Pill";
import { ServiceMark } from "@/components/atoms/ServiceMark";
import { CATEGORIES } from "@/lib/catalog";
import { getCatalog } from "@/lib/data/catalog";
import {
  getGroupInvites,
  getGroupMembers,
  getMemberPayments,
  getMemberships,
  getPendingConfirmations,
  type GroupMember,
} from "@/lib/data/groups";
import { getProfile, initialsOf } from "@/lib/data/profile";
import { requireSession } from "@/lib/data/session";
import { getSubscription } from "@/lib/data/subscriptions";
import { addDays, addMonths, daysBetween, formatDay, formatMonthLong, formatMonthShort, parseISODate } from "@/lib/finance/dates";
import { centsToInput, formatMoney, monthlyEquivalent } from "@/lib/finance/money";
import { calendarSegments, installmentsFor, monthIndex, ownInstallments } from "@/lib/subscriptions/collections";
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
  titleOf,
  totalPaid,
  type PersonalSubscription,
} from "@/lib/subscriptions/personal";
import { relativeDays, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Suscripción · ManagSub" };

const NOTICES: Record<string, { tone: "success" | "error"; text: string }> = {
  creada: { tone: "success", text: "Suscripción guardada." },
  guardada: { tone: "success", text: "Cambios guardados." },
  pago: { tone: "success", text: "Pago anotado." },
  anulado: { tone: "success", text: "Pago borrado. Ya no cuenta; queda en el historial como anulado." },
  unido: { tone: "success", text: "Ya formas parte del grupo." },
  revocada: { tone: "success", text: "Invitación anulada. La plaza vuelve a estar libre." },
  quitado: { tone: "success", text: "Esa persona ya no forma parte del grupo." },
  cobro: { tone: "success", text: "Pago anotado." },
  confirmado: { tone: "success", text: "Pago confirmado." },
  rechazado: { tone: "success", text: "Pago rechazado. Sigue pendiente." },
  cobroAnulado: { tone: "success", text: "Cobro borrado. Ya no cuenta; queda en el historial como anulado." },
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
  const confirmations = sub.role === "leader" ? await getPendingConfirmations(session, sub.id) : [];
  const memberPayments = payments.status === "ok" ? payments.data : [];
  const plan = catalog.flatMap((service) => service.plans).find((item) => item.id === sub.planId) ?? null;
  // Se puede compartir si es personalizada, o si el plan admite más de una persona (o no se sabe).
  const canShare = !shared && sub.participation !== "member" && (plan === null || plan.maxMembers === null || plan.maxMembers >= 2);

  // Calendario: año pedido en la URL (?anio=2027) o el actual.
  const currentYear = parseISODate(today).year;
  const requestedYear = Number(params.anio);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : currentYear;
  // Meses del año elegido; en el año actual, si los dos meses siguientes pasan
  // de diciembre, se añaden los del año siguiente.
  const now = parseISODate(today);
  const nowIndex = monthIndex(now.year, now.month);
  const rangeStart = monthIndex(year, 1);
  const rangeLength = year === currentYear ? Math.max(12, nowIndex + 2 - rangeStart + 1) : 12;
  const calendarMonths = Array.from({ length: rangeLength }, (_, offset) => ({
    year: Math.floor((rangeStart + offset) / 12),
    month: ((rangeStart + offset) % 12) + 1,
  }));
  const last = calendarMonths[calendarMonths.length - 1];
  const rangeEndDate = addDays(addMonths(`${String(last.year).padStart(4, "0")}-${String(last.month).padStart(2, "0")}-01`, 1), -1);
  // Columna del mes actual: la vista se coloca para que se vea él y, como mucho, los dos siguientes.
  const focusCol = year === currentYear ? nowIndex - rangeStart + 1 : null;
  const colors = memberColors(members);
  const names = new Map(members.map((member) => [member.memberId, member]));
  const calendarRows: CalendarRow[] = shared
    ? memberships
        .filter((row) => row.role === "member" && (!isMember || names.get(row.id)?.isMe))
        .map((row) => {
          const member = names.get(row.id);
          const installments = installmentsFor(sub, memberships, row, memberPayments, today, rangeEndDate);
          return {
            key: row.id,
            name: member?.isMe ? "Tú" : (member?.displayName ?? "Participante anterior"),
            initials: initialsOf(member?.displayName ?? "?"),
            hue: colors.get(row.id) ?? "verde",
            isGuest: member?.isGuest ?? false,
            // El líder anota cobros de quien sigue en el grupo; un miembro declara los suyos.
            payAction: member ? ("cobros" as const) : null,
            // Solo quien paga el plan puede anular cobros.
            voidKind: isMember ? null : ("member" as const),
            segments: calendarSegments(installments, rangeStart, rangeLength, sub.billingPeriod),
          };
        })
        .filter((row) => row.segments.length > 0 || names.has(row.key))
    : [
        {
          key: "yo",
          name: "Tú",
          initials: initialsOf(profile.displayName),
          hue: profile.avatarHue,
          isGuest: false,
          payAction: "pago" as const,
          voidKind: "ledger" as const,
          segments: calendarSegments(ownInstallments(sub, today, rangeEndDate), rangeStart, rangeLength, sub.billingPeriod),
        },
      ];
  const calendarHelp = shared
    ? isMember
      ? "Tus pagos a quien paga el plan, mes a mes."
      : "Quién te ha pagado su parte cada mes."
    : sub.participation === "member"
      ? "Lo que has pagado a quien paga el plan, mes a mes."
      : "Los pagos que has anotado, mes a mes.";

  const sections: Section[] = [];
  if (shared) {
    sections.push({
      key: "personas",
      label: "Personas",
      icon: "users",
      title: "Personas",
      size: "lg",
      content: <PeoplePanel sub={sub} members={members} invites={invites} bare />,
    });
    sections.push({
      key: "cobros",
      label: isMember ? "Mis pagos" : "Cobros",
      icon: "wallet",
      title: isMember ? "Mis pagos" : "Cobros",
      size: "lg",
      content: (
        <CollectionsPanel
          sub={sub}
          members={members}
          memberships={memberships}
          payments={memberPayments}
          today={today}
          setupMissing={payments.status === "setup"}
          defaultMemberId={typeof params.miembro === "string" ? params.miembro : undefined}
          defaultRenewal={requestedRenewal || undefined}
        />
      ),
    });
  }
  if (!isMember) {
    // Si es compartida y la pagas tú, el "+" deja elegir entre el pago del servicio y el de una persona.
    const payable = shared && payments.status === "ok" ? payableMembers(sub, members, memberships, memberPayments, today) : [];
    const servicePanel = <PaymentPanel sub={sub} today={today} requested={requestedRenewal} />;
    sections.push({
      key: "pago",
      label: "Anotar pago",
      icon: "plus",
      floating: true,
      title: "Anotar un pago",
      content:
        payable.length > 0 ? (
          <PaymentKindSwitch
            service={servicePanel}
            person={
              <CollectionForm
                sub={sub}
                payable={payable}
                today={today}
                defaultMemberId={typeof params.miembro === "string" ? params.miembro : undefined}
                defaultRenewal={requestedRenewal || undefined}
              />
            }
          />
        ) : (
          servicePanel
        ),
    });
    sections.push({
      key: "ajustes",
      label: "Ajustes",
      icon: "settings",
      title: "Ajustes de la suscripción",
      size: "lg",
      content: (
        <div className="flex flex-col gap-5">
          <ButtonLink href={`/suscripciones/${sub.id}/editar`} icon="pencil">
            Editar datos
          </ButtonLink>
          <History sub={sub} title={shared ? "Tus pagos al servicio" : "Pagos anotados"} />
          {shared ? (
            <section aria-labelledby="cobros-anotados" className="border-t border-rule pt-5">
              <h3 id="cobros-anotados" className="mb-3 text-body font-semibold">
                Cobros anotados
              </h3>
              <CollectedPaymentsHistory sub={sub} members={members} payments={memberPayments} />
            </section>
          ) : null}
          {canShare ? <ShareCard sub={sub} verifiedMax={plan?.maxMembers && plan.maxMembers >= 2 ? plan.maxMembers : null} /> : null}
          <PricePanel sub={sub} today={today} />
          <DangerZone sub={sub} />
        </div>
      ),
    });
  }

  return (
    <>
      <Link href="/suscripciones" className="inline-flex items-center gap-1 rounded-full text-small text-muted hover:text-ink">
        <Icon name="back" /> Suscripciones
      </Link>

      <header className="mt-4 flex min-w-0 items-center gap-4">
        <ServiceMark name={sub.name} category={sub.categoryId} size="lg" />
        <div className="min-w-0">
          <h1 className="text-title font-semibold break-words">{titleOf(sub)}</h1>
          {sub.nickname ? <p className="text-small text-muted">{sub.name}</p> : null}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-muted">
            <StatusPill status={sub.status} />
            {/* Igual para quien paga y para quien no: también si el plan lo paga alguien fuera de la app. */}
            {shared || sub.participation === "member" ? (
              <Pill tone="accent" icon="users">
                Compartida
              </Pill>
            ) : null}
            {sub.role === "leader" ? (
              <Pill tone="warning" icon="crown">
                Propietario
              </Pill>
            ) : null}
            {CATEGORIES[sub.categoryId].name} · {PERIOD_LABEL[sub.billingPeriod]}
          </p>
        </div>
      </header>

      <SectionActions sections={sections} />

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

      {confirmations.length > 0 ? (
        <div className="mt-6">
          <PendingConfirmations items={confirmations} from="suscripcion" showSubscription={false} />
        </div>
      ) : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Overview sub={sub} today={today} members={members} />
        <section aria-labelledby="calendario" className="min-w-0 rounded-card bg-surface p-6 sm:p-8">
          <div className="mb-4">
            <h2 id="calendario" className="text-section font-semibold">
              Calendario de pagos
            </h2>
            <p className="text-small text-muted">{calendarHelp}</p>
          </div>
          {payments.status === "setup" ? (
            <p className="rounded-inner bg-warning-soft px-4 py-3 text-small text-warning-ink">
              Falta aplicar la migración de cobros en Supabase para ver el calendario.
            </p>
          ) : calendarRows.length === 0 ? (
            <p className="rounded-inner bg-raised p-4 text-small text-muted">
              Cuando añadas personas al grupo, aquí verás quién te ha pagado cada mes.
            </p>
          ) : (
            <PaymentCalendar
              key={year}
              rows={calendarRows}
              months={calendarMonths}
              year={year}
              currentYear={currentYear}
              focusCol={focusCol}
              basePath={`/suscripciones/${sub.id}`}
              currency={sub.currency}
              subscriptionId={sub.id}
              subscriptionTitle={titleOf(sub)}
              reminders={sub.role === "leader"}
            />
          )}
        </section>
      </div>

    </>
  );
}

function Overview({ sub, today, members }: { sub: PersonalSubscription; today: string; members: GroupMember[] }) {
  const price = priceOn(sub.prices, today);
  const next = nextRenewal(sub, today);
  const coming = forecasts(sub, today, addMonths(today, sub.billingPeriod === "monthly" ? 3 : 24)).slice(0, 3);
  const per = sub.billingPeriod === "monthly" ? "al mes" : "al año";
  // Si no pagas tú el plan, lo primero es lo que pagas tú y después el total.
  const notOwner = sub.role === "member" || sub.participation === "member";
  const mine = myShareOf(sub, price);
  const payer =
    sub.participation === "member"
      ? (sub.planOwnerName ?? "Otra persona")
      : (members.find((member) => member.role === "leader")?.displayName ?? null);
  // Miembro de un plan que paga alguien fuera de la app: barra de dos tramos (tú y el resto).
  const externalMembers: GroupMember[] =
    sub.participation === "member"
      ? [
          { memberId: "yo", displayName: "Tú", avatarHue: "azul", isGuest: false, role: "member", isMe: true },
          { memberId: "resto", displayName: `Resto del plan (${payer})`, avatarHue: "verde", isGuest: false, role: "leader", isMe: false },
        ]
      : [];
  return (
    <section aria-labelledby="resumen" className="min-w-0 rounded-card bg-surface p-6 sm:p-8">
      <h2 id="resumen" className="sr-only">
        Resumen
      </h2>
      {notOwner ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Money cents={mine} currency={sub.currency} className="text-figure font-bold" />
            <span className="text-body text-muted">{per} · tu parte</span>
          </p>
          <p className="mt-1 text-small text-muted">
            De <Money cents={price} currency={sub.currency} className="font-semibold text-ink" /> {per} en total
            {payer ? ` · lo paga ${payer}` : ""}
          </p>
        </>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <Money cents={price} currency={sub.currency} className="text-figure font-bold" />
          <span className="text-body text-muted">
            {per}
            {sub.mode === "shared" ? " en total" : ""}
          </span>
        </p>
      )}
      {sub.mode === "shared" && members.length > 0 ? (
        <div className="mt-6">
          <ShareBar
            members={members}
            total={price}
            currency={sub.currency}
            period={sub.billingPeriod}
            showAllAmounts={sub.role === "leader"}
            hideMine={notOwner}
          />
        </div>
      ) : null}
      {externalMembers.length > 0 ? (
        <div className="mt-6">
          <ShareBar
            members={externalMembers}
            total={price}
            currency={sub.currency}
            period={sub.billingPeriod}
            showAllAmounts
            hideMine
            shares={
              new Map([
                ["yo", mine],
                ["resto", Math.max(0, price - mine)],
              ])
            }
          />
        </div>
      ) : null}
      {sub.billingPeriod === "yearly" ? (
        <p className="text-small text-muted">
          Unos <Money cents={monthlyEquivalent(myShareOf(sub, price), "yearly")} currency={sub.currency} className="font-semibold text-ink" /> al
          mes equivalentes{sub.mode === "shared" ? " de tu parte" : ""}.
        </p>
      ) : null}

      <div className="mt-6 border-t border-rule pt-5">
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
  // Las mismas renovaciones que el calendario, sin pagar del todo (también la próxima, para pagar por adelantado).
  const options = ownInstallments(sub, today)
    .filter((row) => row.status !== "paid" && row.due > row.confirmed)
    .map((row) => ({
      value: row.date,
      label: `${formatDay(row.date, true)} · ${formatMoney(row.due - row.confirmed, sub.currency)}${
        row.date === today ? " (hoy)" : row.date > today ? " (por adelantado)" : ""
      }`,
      amount: centsToInput(row.due - row.confirmed),
      title: sub.billingPeriod === "monthly" ? formatMonthLong(row.date) : `el año desde el ${formatDay(row.date, true)}`,
    }));
  // Meses pendientes de anotar, entre paréntesis en el aviso: "2 por anotar (sep, oct)".
  const missingMonths = missing
    .slice(0, 4)
    .map((row) => formatMonthShort(row.date).split(" ")[0])
    .join(", ");
  const defaultRenewal = options.some((row) => row.value === requested) ? requested : (options[0]?.value ?? "");
  return (
    <Panel bare>
      {missing.length > 0 ? (
        <p className="mb-3">
          <Pill tone="warning" icon="info">
            {missing.length === 1 ? "1 por anotar" : `${missing.length} por anotar`} ({missingMonths}
            {missing.length > 4 ? "…" : ""})
          </Pill>
        </p>
      ) : null}
      <div className="mb-5">
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
        billingPeriod={sub.billingPeriod}
        currency={sub.currency}
      />
    </Panel>
  );
}

function History({ sub, title }: { sub: PersonalSubscription; title: string }) {
  const payments = sub.entries
    .filter((entry) => entry.kind === "personal_payment")
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : 0));
  const total = totalPaid(sub.entries);
  return (
    <section aria-labelledby="historial" className="border-t border-rule pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="historial" className="text-body font-semibold">
          {title}
        </h3>
        {payments.length > 0 ? (
          <p className="text-small text-muted">
            Total: <Money cents={total} currency={sub.currency} className="font-semibold text-ink" />
          </p>
        ) : null}
      </div>
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
                    {entry.renewalDate
                      ? (entry.periods ?? 1) > 1
                        ? `${entry.periods === 12 ? "Todo el año" : `${entry.periods} meses`} desde el ${formatDay(entry.renewalDate, true)}`
                        : `Renovación del ${formatDay(entry.renewalDate, true)}`
                      : "Pago suelto"}
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
                      Borrar
                    </summary>
                    <form action={voidPayment.bind(null, sub.id, entry.id)} className="mt-2 flex flex-col items-end gap-2">
                      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                      <p className="max-w-56 text-right text-[0.8125rem] text-muted">Dejará de contar. Quedará en el historial como anulado.</p>
                      <SubmitButton variant="danger" pendingLabel="Borrando…">
                        Sí, borrar
                      </SubmitButton>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PricePanel({ sub, today }: { sub: PersonalSubscription; today: string }) {
  const prices = [...sub.prices].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  const latest = latestPrice(sub.prices);
  return (
    <section aria-labelledby="precio">
      <h3 id="precio" className="mb-2 text-body font-semibold">
        Precio
      </h3>
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
    </section>
  );
}

function ShareCard({ sub, verifiedMax }: { sub: PersonalSubscription; verifiedMax: number | null }) {
  return (
    <details className="group rounded-inner border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-inner p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <Icon name="users" size="lg" className="text-accent-ink" />
          <span>
            <span className="block text-body font-semibold">¿La compartes con alguien?</span>
            <span className="block text-small text-muted">Conviértela en un plan compartido y reparte el coste.</span>
          </span>
        </span>
        <Icon name="chevron" className="transition-transform duration-150 group-open:rotate-90" />
      </summary>
      <div className="px-4 pb-4">
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
          Borrar «{titleOf(sub)}»
        </SubmitButton>
      </form>
    </details>
  );
}
