import type { Metadata } from "next";
import Link from "next/link";
import { LoadProblem } from "@/components/app/LoadProblem";
import { StatusPill } from "@/components/subscriptions/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { FloatingActionLink } from "@/components/ui/FloatingAction";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { ServiceMark } from "@/components/ui/ServiceMark";
import { CATEGORIES } from "@/lib/catalog";
import { getProfile } from "@/lib/data/profile";
import { requireSession } from "@/lib/data/session";
import { listSubscriptions } from "@/lib/data/subscriptions";
import { daysBetween, formatDay } from "@/lib/finance/dates";
import { isRunning, missingRenewals, myShareOf, nextRenewal, priceOn, titleOf, type PersonalSubscription } from "@/lib/subscriptions/personal";
import { relativeDays, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Suscripciones · ManagSub" };

export default async function SubscriptionsPage(props: PageProps<"/suscripciones">) {
  const params = await props.searchParams;
  const session = await requireSession();
  const profile = await getProfile(session);
  const today = todayIn(profile.timezone);
  const result = await listSubscriptions(session);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold">Suscripciones</h1>
          <p className="mt-1 text-body text-muted">Todo lo que pagas de forma periódica.</p>
        </div>
      </header>

      {params.salido ? (
        <p role="status" className="mt-6 flex items-center gap-2 rounded-inner bg-positive-soft px-4 py-3 text-small text-positive-ink">
          <Icon name="check" /> Has salido del grupo.
        </p>
      ) : null}
      {params.borrada ? (
        <p role="status" className="mt-6 flex items-center gap-2 rounded-inner bg-positive-soft px-4 py-3 text-small text-positive-ink">
          <Icon name="check" /> Suscripción borrada.
        </p>
      ) : null}

      <div className="mt-8">
        {result.status !== "ok" ? (
          <LoadProblem status={result.status} retryHref="/suscripciones" />
        ) : result.data.length === 0 ? (
          <section className="rounded-card bg-surface p-7 text-center sm:p-10">
            <p className="text-body font-semibold">Aún no has añadido ninguna suscripción.</p>
            <p className="mt-1 text-small text-muted">Empieza por la que más uses.</p>
            <ButtonLink href="/suscripciones/nueva" variant="primary" icon="plus" className="mt-5">
              Añadir suscripción
            </ButtonLink>
          </section>
        ) : (
          <Lists subs={result.data} today={today} />
        )}
      </div>
      <FloatingActionLink href="/suscripciones/nueva" label="Añadir suscripción" />
    </>
  );
}

function Lists({ subs, today }: { subs: PersonalSubscription[]; today: string }) {
  const running = subs.filter(isRunning).sort((a, b) => (nextRenewal(a, today) ?? "") < (nextRenewal(b, today) ?? "") ? -1 : 1);
  const stopped = subs.filter((sub) => !isRunning(sub));
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="activas">
        <h2 id="activas" className="mb-4 text-section font-semibold">
          En marcha <span className="text-muted">· {running.length}</span>
        </h2>
        {running.length === 0 ? (
          <p className="rounded-inner bg-surface p-5 text-small text-muted">No tienes suscripciones activas.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {running.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} today={today} />
            ))}
          </ul>
        )}
      </section>
      {stopped.length > 0 ? (
        <section aria-labelledby="paradas">
          <h2 id="paradas" className="mb-4 text-section font-semibold">
            Pausadas y canceladas <span className="text-muted">· {stopped.length}</span>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stopped.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} today={today} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SubscriptionCard({ sub, today }: { sub: PersonalSubscription; today: string }) {
  const next = nextRenewal(sub, today);
  const missing = missingRenewals(sub, today).length;
  return (
    <li>
      <Link href={`/suscripciones/${sub.id}`} className="flex h-full flex-col gap-4 rounded-card bg-surface p-5 transition-colors duration-150 hover:bg-raised sm:p-6">
        <div className="flex items-start gap-3">
          <ServiceMark name={sub.name} category={sub.categoryId} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold">{titleOf(sub)}</p>
            {sub.nickname ? <p className="truncate text-[0.8125rem] text-muted">{sub.name}</p> : null}
            <p className="text-small text-muted">
              {CATEGORIES[sub.categoryId].name}
              {sub.mode === "shared" ? ` · Compartida (${sub.activeMembers})` : ""}
              {sub.participation === "member" ? " · Eres miembro" : ""}
            </p>
          </div>
          <StatusPill status={sub.status} />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <p className="text-small text-muted">
            {next ? (
              <>
                Renueva el {formatDay(next)}
                <span className="block">{relativeDays(daysBetween(today, next))}</span>
              </>
            ) : sub.status === "cancelled" && sub.paidThroughDate ? (
              <>Pagada hasta el {formatDay(sub.paidThroughDate, true)}</>
            ) : (
              "Sin renovaciones previstas"
            )}
          </p>
          <p className="text-right">
            <Money cents={myShareOf(sub, priceOn(sub.prices, today))} currency={sub.currency} className="text-body font-semibold" />
            <span className="block text-[0.8125rem] text-muted">
              {sub.mode === "shared" || sub.participation === "member" ? "tu parte " : ""}
              {sub.billingPeriod === "monthly" ? "al mes" : "al año"}
            </span>
          </p>
        </div>
        {missing > 0 ? (
          <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-warning-ink">
            <Icon name="info" size="sm" />
            {missing === 1 ? "1 pago por anotar" : `${missing} pagos por anotar`}
          </p>
        ) : null}
      </Link>
    </li>
  );
}
