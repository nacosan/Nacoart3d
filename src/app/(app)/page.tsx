import type { Metadata } from "next";
import Link from "next/link";
import { CategoryBars } from "@/components/charts/CategoryBars";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { Meter } from "@/components/charts/Meter";
import { LoadProblem } from "@/components/app/LoadProblem";
import { ReceivedInvitations } from "@/components/groups/ReceivedInvitations";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { ServiceMark } from "@/components/ui/ServiceMark";
import { CATEGORIES } from "@/lib/catalog";
import { getReceivedInvitations, type ReceivedInvitation } from "@/lib/data/groups";
import { firstName, getProfile } from "@/lib/data/profile";
import { requireSession } from "@/lib/data/session";
import { listSubscriptions } from "@/lib/data/subscriptions";
import { addDays, daysBetween, formatDay, formatMonthLong, formatMonthShort, parseISODate, type ISODate } from "@/lib/finance/dates";
import { formatMoney, formatPercent, percentOf, type Currency } from "@/lib/finance/money";
import {
  categoryTotals,
  forecasts,
  missingRenewals,
  paidByMonth,
  totalsByCurrency,
  type Forecast,
  type PersonalSubscription,
} from "@/lib/subscriptions/personal";
import { relativeDays, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Resumen · NacoArt3D" };

const UPCOMING_DAYS = 30;

function greeting(timezone: string): string {
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat("es-ES", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  } catch {
    // Zona no válida: saludo neutro.
  }
  if (hour >= 6 && hour < 14) return "Buenos días";
  if (hour >= 14 && hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

const INVITATION_NOTICES: Record<string, { tone: "success" | "error"; text: string }> = {
  rechazada: { tone: "success", text: "Invitación rechazada." },
  llena: { tone: "error", text: "Ese grupo ya está completo. Pide a quien te invitó que haga sitio." },
  error: { tone: "error", text: "No hemos podido responder a la invitación. Puede que haya caducado o la hayan anulado." },
};

function Notices({ invitations, notice }: { invitations: ReceivedInvitation[]; notice: string | undefined }) {
  const message = notice ? INVITATION_NOTICES[notice] : undefined;
  return (
    <>
      {message ? (
        <p
          role="status"
          className={`mt-6 flex items-center gap-2 rounded-inner px-4 py-3 text-small ${
            message.tone === "success" ? "bg-positive-soft text-positive-ink" : "bg-negative-soft text-negative-ink"
          }`}
        >
          <Icon name={message.tone === "success" ? "check" : "alert"} /> {message.text}
        </p>
      ) : null}
      {invitations.length > 0 ? (
        <div className="mt-6">
          <ReceivedInvitations invitations={invitations} />
        </div>
      ) : null}
    </>
  );
}

export default async function SummaryPage(props: PageProps<"/">) {
  const params = await props.searchParams;
  const notice = typeof params.invitacion === "string" ? params.invitacion : undefined;
  const session = await requireSession();
  const profile = await getProfile(session);
  const today = todayIn(profile.timezone);
  const [result, invitations] = await Promise.all([listSubscriptions(session), getReceivedInvitations(session)]);
  const hello = `${greeting(profile.timezone)}, ${firstName(profile.displayName)}`;

  if (result.status !== "ok") {
    return (
      <>
        <h1 className="text-title font-semibold">{hello}</h1>
        <Notices invitations={invitations} notice={notice} />
        <div className="mt-8">
          <LoadProblem status={result.status} retryHref="/" />
        </div>
      </>
    );
  }

  const subs = result.data;
  if (subs.length === 0) {
    return (
      <>
        <Welcome hello={hello} />
        <Notices invitations={invitations} notice={notice} />
      </>
    );
  }

  const upcoming = subs
    .flatMap((sub) => forecasts(sub, today, addDays(today, UPCOMING_DAYS)))
    .filter((row) => !row.paid)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name, "es")));
  const missing = subs.flatMap((sub) => missingRenewals(sub, today)).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <header>
        <h1 className="text-title font-semibold">{hello}</h1>
        <p className="mt-1 max-w-[60ch] text-body text-muted">{headline(upcoming, missing, today)}</p>
      </header>
      <Notices invitations={invitations} notice={notice} />

      <div className="mt-8 flex flex-col gap-6">
        <HeroCard subs={subs} today={today} currency={profile.currency} budget={profile.monthlyBudgetCents} />

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <UpcomingCard rows={upcoming} today={today} />
          <MissingCard rows={missing} />
        </div>

        <MoreDetails subs={subs} today={today} currency={profile.currency} />
      </div>
    </>
  );
}

function headline(upcoming: Forecast[], missing: Forecast[], today: ISODate): string {
  const next = upcoming[0];
  const parts: string[] = [];
  if (next) {
    parts.push(`Tu próxima renovación es ${next.name}, ${relativeDays(daysBetween(today, next.date))}.`);
  } else {
    parts.push(`No tienes renovaciones en los próximos ${UPCOMING_DAYS} días.`);
  }
  if (missing.length > 0) {
    parts.push(missing.length === 1 ? "Hay 1 pago pendiente de anotar." : `Hay ${missing.length} pagos pendientes de anotar.`);
  }
  return parts.join(" ");
}

function Welcome({ hello }: { hello: string }) {
  return (
    <>
      <h1 className="text-title font-semibold">{hello}</h1>
      <section className="mt-8 flex flex-col items-start gap-5 rounded-card bg-surface p-7 sm:p-10" aria-labelledby="bienvenida">
        <span aria-hidden="true" className="inline-flex size-14 items-center justify-center rounded-[18px] bg-accent-soft text-accent-ink">
          <Icon name="wallet" size="lg" />
        </span>
        <div>
          <h2 id="bienvenida" className="text-section font-semibold">
            Empieza por tu primera suscripción
          </h2>
          <p className="mt-2 max-w-[55ch] text-body text-muted">
            Apunta lo que pagas y cada cuánto. Te diremos cuánto te cuesta al mes, cuándo renueva cada una y qué pagos
            te falta anotar.
          </p>
        </div>
        <ButtonLink href="/suscripciones/nueva" variant="primary" icon="plus">
          Añadir suscripción
        </ButtonLink>
      </section>
    </>
  );
}

function HeroCard({
  subs,
  today,
  currency,
  budget,
}: {
  subs: PersonalSubscription[];
  today: ISODate;
  currency: Currency;
  budget: number | null;
}) {
  const [main, ...others] = totalsByCurrency(subs, today, currency);
  const inactive = subs.length - subs.filter((sub) => sub.status === "active" || sub.status === "trial").length;
  const share = budget ? percentOf(main.monthly, budget) : null;

  return (
    <section aria-labelledby="gasto" className="rounded-card bg-surface p-6 sm:p-9">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="gasto" className="text-body text-muted">
            Tus suscripciones te cuestan
          </h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <Money cents={main.monthly} currency={main.currency} className="text-hero font-bold tracking-tight" />
            <span className="text-body text-muted">al mes</span>
          </p>
          <p className="mt-1 text-small text-muted">
            Unos <Money cents={main.annual} currency={main.currency} className="font-semibold text-ink" /> al año ·{" "}
            {main.count === 1 ? "1 activa" : `${main.count} activas`}
            {inactive > 0 ? ` · ${inactive} pausada${inactive === 1 ? "" : "s"} o cancelada${inactive === 1 ? "" : "s"} no cuentan` : ""}
          </p>
          {others.map((row) => (
            <p key={row.currency} className="mt-1 text-small text-muted">
              Además, <Money cents={row.monthly} currency={row.currency} className="font-semibold text-ink" /> al mes en{" "}
              {row.currency} ({row.count === 1 ? "1 suscripción" : `${row.count} suscripciones`}).
            </p>
          ))}
        </div>
        <ButtonLink href="/suscripciones/nueva" variant="primary" icon="plus">
          Añadir suscripción
        </ButtonLink>
      </div>

      {budget ? (
        <div className="mt-7 rounded-inner bg-raised p-4 sm:p-5">
          <Meter
            ratio={main.monthly / budget}
            tone={main.monthly > budget ? "negative" : "accent"}
            height={10}
            label={`${formatPercent(share)} de tu presupuesto mensual`}
          />
          <p className="mt-2.5 text-small text-muted">
            {main.monthly <= budget ? (
              <>
                Llevas el {formatPercent(share)} de tu presupuesto de <Money cents={budget} currency={currency} />. Te quedan{" "}
                <Money cents={budget - main.monthly} currency={currency} className="font-semibold text-ink" />.
              </>
            ) : (
              <>
                Te pasas en <Money cents={main.monthly - budget} currency={currency} className="font-semibold text-negative-ink" /> de
                tu presupuesto de <Money cents={budget} currency={currency} />.
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-6 text-small text-muted">
          <Link href="/ajustes" className="font-medium text-accent-ink hover:underline">
            Ponte un presupuesto mensual
          </Link>{" "}
          y te diremos cuánto margen te queda.
        </p>
      )}
      <p className="mt-4 text-[0.8125rem] text-muted">
        Es el coste mensual equivalente: un plan anual cuenta su precio entre 12. No es dinero cobrado cada mes.
      </p>
    </section>
  );
}

function DateBadge({ date }: { date: ISODate }) {
  const { day } = parseISODate(date);
  return (
    <span className="flex w-12 flex-none flex-col items-center rounded-[14px] bg-raised py-1.5 leading-tight">
      <span className="text-body font-semibold tabular-nums">{day}</span>
      <span className="text-[0.75rem] text-muted">{formatMonthShort(date).split(" ")[0]}</span>
    </span>
  );
}

function UpcomingCard({ rows, today }: { rows: Forecast[]; today: ISODate }) {
  const shown = rows.slice(0, 4);
  return (
    <Panel title="Lo próximo" titleId="proximo" aside={`Próximos ${UPCOMING_DAYS} días`}>
      {shown.length === 0 ? (
        <p className="rounded-inner bg-raised p-4 text-small text-muted">Nada a la vista. Disfruta del respiro.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((row) => (
            <li key={`${row.subscriptionId}-${row.date}`}>
              <Link
                href={`/suscripciones/${row.subscriptionId}`}
                className="-mx-2 flex items-center gap-3 rounded-inner px-2 py-2 hover:bg-raised"
              >
                <DateBadge date={row.date} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold">{row.name}</span>
                  <span className="block text-[0.8125rem] text-muted">Renueva {relativeDays(daysBetween(today, row.date))}</span>
                </span>
                <Money cents={row.amount} currency={row.currency} className="text-small font-semibold" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length > shown.length ? (
        <p className="mt-3 text-small text-muted">
          Y {rows.length - shown.length} más.{" "}
          <Link href="/suscripciones" className="font-medium text-accent-ink hover:underline">
            Ver todas
          </Link>
        </p>
      ) : null}
      <p className="mt-4 text-[0.8125rem] text-muted">Son previsiones según lo que contrataste, no pagos.</p>
    </Panel>
  );
}

function MissingCard({ rows }: { rows: Forecast[] }) {
  if (rows.length === 0) {
    return (
      <Panel title="Pagos por anotar" titleId="por-anotar">
        <p className="flex items-center gap-3 rounded-inner bg-positive-soft p-4 text-small text-positive-ink">
          <Icon name="check" size="lg" />
          Todo anotado. Cada renovación pasada tiene su pago registrado.
        </p>
      </Panel>
    );
  }
  const shown = rows.slice(0, 3);
  return (
    <Panel title="Pagos por anotar" titleId="por-anotar" aside={<Pill tone="warning" icon="info">{rows.length}</Pill>}>
      <ul className="flex flex-col gap-1">
        {shown.map((row) => (
          <li key={`${row.subscriptionId}-${row.date}`}>
            <Link
              href={`/suscripciones/${row.subscriptionId}?renovacion=${row.date}#registrar-pago`}
              className="-mx-2 flex items-center gap-3 rounded-inner px-2 py-2 hover:bg-raised"
            >
              <ServiceMark name={row.name} category={row.categoryId} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-semibold">{row.name}</span>
                <span className="block text-[0.8125rem] text-muted">Renovó el {formatDay(row.date, true)}</span>
              </span>
              <span className="text-small font-semibold text-accent-ink">Anotar</span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > shown.length ? <p className="mt-3 text-small text-muted">Y {rows.length - shown.length} más.</p> : null}
      <p className="mt-4 text-[0.8125rem] text-muted">
        No es una deuda: solo falta apuntar que pagaste esas renovaciones.
      </p>
    </Panel>
  );
}

function MoreDetails({ subs, today, currency }: { subs: PersonalSubscription[]; today: ISODate; currency: Currency }) {
  const categories = categoryTotals(subs, today, currency);
  const total = categories.reduce((sum, row) => sum + row.amount, 0);
  const months = paidByMonth(subs, today, currency);
  const current = months[months.length - 1];
  return (
    <details className="group rounded-card bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card p-6 sm:px-9 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <Icon name="chart" size="lg" className="text-accent-ink" />
          <span>
            <span className="block text-body font-semibold">Ver más detalles</span>
            <span className="block text-small text-muted">Reparto por categoría y pagos de los últimos 12 meses</span>
          </span>
        </span>
        <Icon name="chevron" className="transition-transform duration-150 group-open:rotate-90" />
      </summary>
      <div className="grid gap-10 border-t border-rule p-6 sm:p-9 lg:grid-cols-2">
        <section aria-labelledby="categorias">
          <h2 id="categorias" className="text-body font-semibold">
            En qué se va tu dinero
          </h2>
          <p className="mb-4 text-small text-muted">Coste al mes por categoría ({currency}).</p>
          {categories.length === 0 ? (
            <p className="text-small text-muted">No hay suscripciones activas en {currency}.</p>
          ) : (
            <CategoryBars
              label="Coste mensual por categoría"
              currency={currency}
              rows={categories.map((row) => ({
                category: row.categoryId,
                name: CATEGORIES[row.categoryId].name,
                amount: row.amount,
                share: percentOf(row.amount, total),
              }))}
            />
          )}
        </section>
        <section aria-labelledby="pagado">
          <h2 id="pagado" className="text-body font-semibold">
            Lo que has pagado
          </h2>
          <p className="mb-4 text-small text-muted">Solo los pagos que has anotado, mes a mes.</p>
          <ColumnChart
            currency={currency}
            caption={`${formatMonthLong(current.start)}, hasta hoy: ${formatMoney(current.amount, currency)} pagados. No incluye previsiones.`}
            columns={months.map((month) => ({
              key: month.month,
              label: formatMonthShort(month.start).split(" ")[0],
              longLabel: formatMonthLong(month.start),
              value: month.amount,
              highlight: month.month === current.month,
            }))}
          />
        </section>
      </div>
    </details>
  );
}
