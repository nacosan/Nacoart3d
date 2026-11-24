import Link from "next/link";
import { reviewMemberPayment } from "@/app/(app)/grupos/actions";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import type { PendingConfirmation } from "@/lib/data/groups";
import { formatDay, formatMonthShort } from "@/lib/finance/dates";

function coverLabel(item: PendingConfirmation) {
  const start = item.billingPeriod === "monthly" ? formatMonthShort(item.renewalDate) : `el año desde el ${formatDay(item.renewalDate, true)}`;
  if (item.periods <= 1) return start;
  return `${item.periods === 12 ? "todo el año" : `${item.periods} meses`} desde ${start}`;
}

/**
 * Pagos que te han declarado y esperan tu confirmación, con Confirmar y
 * Rechazar a mano (sin abrir la suscripción). No se muestra nada si no hay.
 */
export function PendingConfirmations({
  items,
  from,
  showSubscription,
}: {
  items: PendingConfirmation[];
  from: "resumen" | "suscripcion";
  /** Mostrar a qué suscripción pertenece cada pago (en el Resumen). */
  showSubscription: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="por-confirmar" className="rounded-card bg-accent-soft p-5 sm:p-6">
      <h2 id="por-confirmar" className="flex items-center gap-2 text-body font-semibold text-accent-ink">
        <Icon name="hourglass" />
        {items.length === 1 ? "Tienes un pago por confirmar" : `Tienes ${items.length} pagos por confirmar`}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 rounded-inner bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-small">
              <p className="font-semibold">
                {item.memberName} dice que te ha pagado <Money cents={item.amountCents} currency={item.currency} />
              </p>
              <p className="text-[0.8125rem] text-muted">
                {showSubscription ? (
                  <>
                    <Link href={`/suscripciones/${item.subscriptionId}`} className="font-medium text-accent-ink hover:underline">
                      {item.subscriptionTitle}
                    </Link>{" "}
                    ·{" "}
                  </>
                ) : null}
                {coverLabel(item)} · enviado el {formatDay(item.paidOn, true)}
                {item.note ? ` · ${item.note}` : ""}
              </p>
            </div>
            <div className="flex flex-none gap-2">
              <form action={reviewMemberPayment.bind(null, item.subscriptionId, item.id, false, from)}>
                <SubmitButton variant="secondary" pendingLabel="…" className="h-9 px-4">
                  Rechazar
                </SubmitButton>
              </form>
              <form action={reviewMemberPayment.bind(null, item.subscriptionId, item.id, true, from)}>
                <SubmitButton icon="check" pendingLabel="…" className="h-9 px-4">
                  Confirmar
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
