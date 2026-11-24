import { dismissPaymentReminder } from "@/app/(app)/grupos/actions";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import type { ReceivedReminder } from "@/lib/data/groups";
import { formatDay, formatMonthLong } from "@/lib/finance/dates";

/** Recordatorios de pago recibidos, con "He pagado" y "Cerrar". No muestra nada si no hay. */
export function ReceivedReminders({ items }: { items: ReceivedReminder[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recordatorios" className="rounded-card bg-warning-soft p-5 sm:p-6">
      <h2 id="recordatorios" className="flex items-center gap-2 text-body font-semibold text-warning-ink">
        <Icon name="clock" />
        {items.length === 1 ? "Tienes un pago pendiente" : `Tienes ${items.length} pagos pendientes`}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 rounded-inner bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-small">
              <span className="font-semibold">{item.leaderName}</span> te recuerda el pago de{" "}
              {item.billingPeriod === "monthly"
                ? formatMonthLong(item.renewalDate)
                : `el año desde el ${formatDay(item.renewalDate, true)}`}{" "}
              de <span className="font-semibold">{item.subscriptionTitle}</span>:{" "}
              <Money cents={item.amountCents} currency={item.currency} className="font-semibold" />
            </p>
            <div className="flex flex-none gap-2">
              <form action={dismissPaymentReminder.bind(null, item.id)}>
                <SubmitButton variant="secondary" pendingLabel="…" className="h-9 px-4">
                  Cerrar
                </SubmitButton>
              </form>
              <ButtonLink
                href={`/suscripciones/${item.subscriptionId}?abrir=cobros&renovacion=${item.renewalDate}&miembro=${item.memberId}`}
                variant="primary"
                icon="check"
                className="h-9 px-4"
              >
                He pagado
              </ButtonLink>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
