import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { CoverageStrip } from "@/components/prototype/CoverageStrip";
import {
  ConditionsPanel,
  GroupHeader,
  MovementsPanel,
  PrototypeActionNote,
  SplitPanel,
  type MovementRow,
} from "@/components/prototype/GroupPieces";
import { Meter } from "@/components/charts/Meter";
import { PrototypeNotice } from "@/components/prototype/PrototypeNotice";
import { SeatRow } from "@/components/prototype/SeatRow";
import { memberSegments } from "@/components/prototype/coverage";
import { memberNav } from "@/components/prototype/navigation";
import { formatDay, formatMonthLong } from "@/lib/finance/dates";
import { annualEquivalent, formatPercent, percentOf } from "@/lib/finance/money";
import { TODAY, memberView, ondas } from "@/prototype/model";

export const metadata = { title: "Ondas Familiar · miembro · Prototipo" };

/**
 * Vista de miembro. Solo recibe `memberView()`: los datos propios de Lucía y
 * lo común del grupo (precio, regla de reparto, nombres y plazas). No hay
 * importes, plazos ni movimientos de otros participantes en estos datos.
 */
const view = memberView(ondas, "lucia");

export default function MemberGroupPage() {
  const me = view.me;
  const next = me.nextInstallment;
  const remaining = next ? next.amount - next.allocated : 0;
  const share = percentOf(me.share, view.price);

  const movementRows: MovementRow[] = me.payments
    .slice()
    .sort((a, b) => (a.occurredOn > b.occurredOn ? -1 : 1))
    .slice(0, 6)
    .map((payment) => ({
      id: payment.id,
      date: payment.occurredOn,
      concept: payment.concept,
      amount: payment.amount,
      direction: "out",
      status: payment.status,
    }));

  return (
    <AppShell
      nav={memberNav}
      current="/prototipo/grupos/ondas/miembro"
      viewer={{ name: me.person.name, initials: me.person.initials, hue: me.person.hue }}
      screenTitle={view.name}
      notice={<PrototypeNotice current="/prototipo/grupos/ondas/miembro" />}
    >
      <GroupHeader
        name={view.name}
        category={view.category}
        subtitle={
          <>
            {view.plan} · Eres miembro · Líder: {view.leader.name}
          </>
        }
        finding={
          next && remaining > 0 ? (
            <>
              Te {remaining === 1 ? "queda" : "quedan"} <Money cents={remaining} className="font-semibold" /> del plazo de{" "}
              {formatMonthLong(next.coversFrom).split(" ")[0]}. Vence el {formatDay(next.dueDate)}.
            </>
          ) : (
            "Estás al día."
          )
        }
        actions={
          <>
            <Button variant="primary" icon="send" disabled describedBy="accion-miembro">
              He enviado el pago
            </Button>
            <PrototypeActionNote id="accion-miembro" />
          </>
        }
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <Panel title="Tu parte" titleId="tu-parte">
          <p className="text-figure font-semibold">
            <Money cents={me.share} />
            <span className="ml-1 text-body font-normal text-muted">al mes</span>
          </p>
          <p className="text-small text-muted">
            de <Money cents={view.price} className="text-ink" /> que cuesta el plan completo ({formatPercent(share)}).
            Equivale a <Money cents={annualEquivalent(me.share, view.period)} className="text-ink" /> al año.
          </p>
          <div className="mt-4">
            <Meter ratio={me.share / view.price} tone="accent" label={`Tu parte es el ${formatPercent(share)} del plan`} />
          </div>
          <dl className="mt-5 flex flex-col divide-y divide-rule text-small">
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-muted">Tu acuerdo</dt>
              <dd className="text-right">{me.agreement?.label}</dd>
            </div>
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-muted">Frente al plan completo</dt>
              <dd className="text-right">
                <Money cents={view.price - me.share} /> menos al mes
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-muted">Frente a un plan individual</dt>
              <dd className="text-right text-muted">Sin precio verificado para comparar</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Tu situación" titleId="situacion" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-inner bg-rule sm:grid-cols-4">
            <div className="bg-surface p-4">
              <dt className="text-small text-muted">Cubierto hasta</dt>
              <dd className="text-section font-semibold tabular-nums">
                {me.coveredThrough ? formatDay(me.coveredThrough, true) : "—"}
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="text-small text-muted">Pendiente</dt>
              <dd>
                <Money cents={me.uncovered} className="text-section font-semibold" />
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="text-small text-muted">Vencido</dt>
              <dd>
                <Money cents={me.overdue} className="text-section font-semibold" />
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="text-small text-muted">Saldo a favor</dt>
              <dd>
                <Money cents={me.credit} className="text-section font-semibold" />
              </dd>
            </div>
          </dl>
          {next ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-inner bg-raised p-4">
              <div className="min-w-0">
                <p className="text-small font-semibold">Plazo de {formatMonthLong(next.coversFrom)}</p>
                <p className="text-small text-muted">
                  Pagado <Money cents={next.allocated} className="text-ink" /> de <Money cents={next.amount} className="text-ink" />{" "}
                  · vence el {formatDay(next.dueDate)} · {view.graceDays} días de gracia
                </p>
              </div>
              {next.status === "partial" ? (
                <Pill tone="warning" icon="half">
                  Pago parcial
                </Pill>
              ) : next.status === "overdue" ? (
                <Pill tone="negative" icon="alert">
                  Vencido
                </Pill>
              ) : (
                <Pill tone="neutral" icon="clock">
                  Pendiente
                </Pill>
              )}
            </div>
          ) : null}
          <p className="mt-3 text-small text-muted">
            {me.declaredPending > 0
              ? "Tienes un pago declarado esperando la confirmación del líder."
              : "No tienes pagos declarados pendientes de confirmar."}{" "}
            Un pago solo cuenta cuando {view.leader.name.split(" ")[0]} confirma que lo ha recibido.
          </p>
        </Panel>

        <Panel title="Tu cobertura" titleId="tu-cobertura" aside="Solo tus plazos" className="lg:col-span-3">
          <CoverageStrip
            periods={view.periods}
            label="Tu cobertura, desplazable"
            today={TODAY}
            rows={[
              {
                key: me.person.id,
                name: `${me.person.name} (tú)`,
                initials: me.person.initials,
                hue: me.person.hue,
                guest: false,
                caption: me.agreement?.label ?? "",
                segments: memberSegments(me, view.periods),
              },
            ]}
          />
        </Panel>

        <MovementsPanel
          title="Tus pagos"
          rows={movementRows}
          total={me.payments.length}
          className="lg:col-span-2"
          note="Solo ves tus propios pagos."
        />

        <Panel title="Plazas del grupo" titleId="plazas">
          <SeatRow
            people={view.roster.map((person) => ({ ...person }))}
            reserved={view.seats.reserved}
            reservedUntil={view.seats.reservedUntil}
            free={view.seats.free}
            max={view.seats.max}
          />
          <p className="mt-3 flex gap-2 text-small text-muted">
            <Icon name="lock" className="mt-0.5" />
            Ves quién participa, pero no los importes, pagos ni deudas de nadie más.
          </p>
        </Panel>

        <SplitPanel
          price={view.price}
          participants={view.roster.length}
          share={me.share}
          remainderHolder={`${view.leader.name.split(" ")[0]} (líder)`}
          seatsMax={view.seats.max}
          className="lg:col-span-2"
        />

        <ConditionsPanel plan={view.plan} conditions={view.conditions} />
      </div>
    </AppShell>
  );
}
