import { AppShell } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { CoverageStrip, type StripRow } from "@/components/prototype/CoverageStrip";
import {
  ConditionsPanel,
  GroupHeader,
  MovementsPanel,
  PrototypeActionNote,
  SplitPanel,
  type MovementRow,
} from "@/components/prototype/GroupPieces";
import { PrototypeNotice } from "@/components/prototype/PrototypeNotice";
import { SeatRow } from "@/components/prototype/SeatRow";
import { memberSegments, providerSegments } from "@/components/prototype/coverage";
import { leaderNav } from "@/components/prototype/navigation";
import { formatDay, formatMonthLong } from "@/lib/finance/dates";
import { formatMoney } from "@/lib/finance/money";
import { PEOPLE } from "@/prototype/data";
import { TODAY, leaderMovements, ondas, type MemberLedger } from "@/prototype/model";

export const metadata = { title: "Ondas Familiar · líder · Prototipo" };

const STATUS = {
  overdue: { tone: "negative", icon: "alert", label: "Vencido" },
  awaiting: { tone: "accent", icon: "hourglass", label: "Por confirmar" },
  partial: { tone: "warning", icon: "half", label: "Pago parcial" },
  ok: { tone: "positive", icon: "check", label: "Al día" },
} as const;

function memberState(member: MemberLedger): keyof typeof STATUS {
  if (member.overdue > 0) return "overdue";
  if (member.declaredPending > 0) return "awaiting";
  if (member.uncovered > 0) return "partial";
  return "ok";
}

function firstName(name: string) {
  return name.split(" ")[0];
}

export default function LeaderGroupPage() {
  const group = ondas;
  const t = group.treasury;
  const leader = group.members.find((member) => member.role === "leader");
  const others = group.members.filter((member) => member.role !== "leader");
  const overdue = others.filter((member) => member.overdue > 0);
  const awaiting = others.filter((member) => member.declaredPending > 0);

  const stripRows: StripRow[] = [
    ...(leader
      ? [
          {
            key: leader.person.id,
            name: `${leader.person.name} (tú)`,
            initials: leader.person.initials,
            hue: leader.person.hue,
            guest: false,
            caption: "Líder · paga al proveedor",
            segments: providerSegments(group),
          },
        ]
      : []),
    ...others.map((member) => ({
      key: member.person.id,
      name: member.person.name,
      initials: member.person.initials,
      hue: member.person.hue,
      guest: !member.person.hasAccount,
      caption: `${member.agreement?.period === "yearly" ? "Acuerdo anual" : "Acuerdo mensual"}${member.person.hasAccount ? "" : " · sin cuenta"}`,
      segments: memberSegments(member, group.periods),
    })),
  ];

  const movements = leaderMovements(group);
  const movementRows: MovementRow[] = movements.slice(0, 8).map((movement) => ({
    id: movement.id,
    date: movement.date,
    concept: movement.concept,
    person:
      movement.kind === "member"
        ? {
            name: movement.person.name,
            initials: movement.person.initials,
            hue: movement.person.hue,
            guest: !movement.person.hasAccount,
          }
        : undefined,
    amount: movement.amount,
    direction: movement.kind === "member" ? "in" : "out",
    status: movement.status,
  }));

  const kpis = [
    { label: "Pagado al proveedor", value: t.paidProvider, note: `${group.spec.providerPayments.length} pagos` },
    { label: "Cobrado", value: t.collected, note: "Confirmado" },
    { label: "Adelanto neto", value: t.net, note: "Pagado − cobrado", lead: true },
    { label: "Tu parte", value: t.leaderShare, note: `${group.snapshotCount} meses` },
    { label: "Sin cubrir", value: t.uncovered, note: "De los demás, hasta hoy" },
    { label: "Cobrado por adelantado", value: t.prepaid, note: "Plazos futuros y saldo" },
  ];

  return (
    <AppShell
      nav={leaderNav}
      current="/prototipo/grupos/ondas"
      viewer={{ name: PEOPLE.ana.name, initials: PEOPLE.ana.initials, hue: PEOPLE.ana.hue }}
      screenTitle={group.spec.name}
      notice={<PrototypeNotice current="/prototipo/grupos/ondas" />}
    >
      <GroupHeader
        name={group.spec.name}
        category={group.spec.category}
        subtitle={
          <>
            {group.spec.plan} · <Money cents={group.spec.price} /> al mes · Lideras este grupo · Grupo activo
          </>
        }
        finding={
          <>
            {overdue.map((member) => (
              <span key={member.person.id}>
                <strong className="font-semibold">{firstName(member.person.name)}</strong> debe{" "}
                <Money cents={member.overdue} className="font-semibold" /> vencidos
                {member.oldestOverdueSince ? ` desde el ${formatDay(member.oldestOverdueSince)}` : ""}.{" "}
              </span>
            ))}
            {awaiting.map((member) => (
              <span key={member.person.id}>
                <strong className="font-semibold">{firstName(member.person.name)}</strong> declaró un pago de{" "}
                <Money cents={member.declaredPending} className="font-semibold" /> pendiente de tu confirmación.
              </span>
            ))}
          </>
        }
        actions={
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon="plus" disabled describedBy="acciones-lider">
                Registrar cobro
              </Button>
              <Button icon="send" disabled describedBy="acciones-lider">
                Invitar
              </Button>
            </div>
            <PrototypeActionNote id="acciones-lider" />
          </>
        }
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <Panel title="Tesorería" titleId="tesoreria" aside={`Desde el ${formatDay(group.spec.anchor, true)}`} className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-inner bg-rule sm:grid-cols-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-surface p-4">
                <dt className="text-small text-muted">{kpi.label}</dt>
                <dd>
                  <Money
                    cents={kpi.value}
                    className={`block font-semibold ${kpi.lead ? "text-figure" : "text-section"}`}
                  />
                  <span className="text-[0.8125rem] text-muted">{kpi.note}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-small text-muted">
            Cuadra sin diferencias: tu parte <Money cents={t.leaderShare} className="text-ink" /> + sin cubrir{" "}
            <Money cents={t.uncovered} className="text-ink" /> − cobrado por adelantado{" "}
            <Money cents={t.prepaid} className="text-ink" /> = <Money cents={t.net} className="font-semibold text-ink" /> de
            adelanto neto.
          </p>
          <p className="mt-2 text-small text-muted">
            Sin cubrir: <Money cents={t.uncoveredOverdue} className="text-ink" /> vencido ·{" "}
            <Money cents={t.uncoveredAwaiting} className="text-ink" /> por confirmar ·{" "}
            <Money cents={t.uncoveredNotDue} className="text-ink" /> aún no vence.
          </p>
        </Panel>

        <Panel
          title="Por confirmar"
          titleId="por-confirmar"
          aside={`${awaiting.length} ${awaiting.length === 1 ? "pago" : "pagos"}`}
        >
          {awaiting.length === 0 ? (
            <p className="text-small text-muted">No hay pagos declarados pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {awaiting.map((member) => {
                const declared = member.payments.filter((payment) => payment.status === "declared");
                return declared.map((payment) => (
                  <li key={payment.id} className="rounded-inner bg-raised p-4">
                    <div className="flex items-center gap-3">
                      <Avatar initials={member.person.initials} hue={member.person.hue} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-semibold">{member.person.name}</p>
                        <p className="text-[0.8125rem] text-muted">
                          {payment.concept} · declarado el {formatDay(payment.occurredOn)}
                        </p>
                      </div>
                      <Money cents={payment.amount} className="text-body font-semibold" />
                    </div>
                    <p className="mt-3 text-[0.8125rem] text-muted">
                      {(() => {
                        const target = member.installments.find((item) => item.id === payment.targetInstallmentId);
                        return target ? `Para el plazo de ${formatMonthLong(target.coversFrom)}. ` : "";
                      })()}
                      Hasta que lo confirmes no cuenta como cobrado ni cubre el periodo.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="primary" icon="check" disabled describedBy="acciones-confirmar">
                        Confirmar recepción
                      </Button>
                      <Button icon="close" disabled describedBy="acciones-confirmar">
                        Rechazar
                      </Button>
                    </div>
                  </li>
                ));
              })}
            </ul>
          )}
          <div className="mt-3">
            <PrototypeActionNote id="acciones-confirmar" />
          </div>
        </Panel>

        <Panel title="Cobertura" titleId="cobertura" aside="Solo la ves tú, como líder" className="lg:col-span-3">
          <CoverageStrip
            periods={group.periods}
            rows={stripRows}
            label="Cobertura de todos los participantes, desplazable"
            today={TODAY}
          />
        </Panel>

        <Panel title="Participantes" titleId="participantes" aside={`${group.members.length} activos`} className="lg:col-span-3">
          <ParticipantsTable members={group.members} />
        </Panel>

        <Panel title="Plazas" titleId="plazas" className="lg:col-span-2">
          <SeatRow
            people={group.members.map((member) => ({
              initials: member.person.initials,
              name: member.person.name,
              hue: member.person.hue,
              isLeader: member.role === "leader",
              hasAccount: member.person.hasAccount,
              isYou: member.role === "leader",
            }))}
            reserved={group.seats.reserved}
            reservedUntil={group.seats.reservedUntil}
            free={group.seats.free}
            max={group.seats.max}
          />
          {group.spec.invitations.map((invite) => (
            <p key={invite.id} className="mt-3 flex flex-wrap items-center gap-2 text-small text-muted">
              <Pill tone="accent" icon="clock">
                Invitación pendiente
              </Pill>
              Restringida a {invite.restrictedTo}. Reserva una plaza hasta el {formatDay(invite.reservesSeatUntil)} y no
              genera coste hasta que se acepte.
            </p>
          ))}
        </Panel>

        <SplitPanel
          price={group.spec.price}
          participants={group.members.length}
          share={leader?.share ?? 0}
          remainderHolder={leader ? `${firstName(leader.person.name)} (líder)` : "el líder"}
          seatsMax={group.seats.max}
        />

        <MovementsPanel
          title="Movimientos"
          rows={movementRows}
          total={movements.length}
          className="lg:col-span-2"
          note="Los movimientos confirmados no se editan ni se borran: se corrigen con un movimiento de ajuste o anulación."
        />

        <ConditionsPanel plan={group.spec.plan} conditions={group.spec.conditions} />
      </div>
    </AppShell>
  );
}

function ParticipantsTable({ members }: { members: MemberLedger[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[52rem] text-small">
          <thead>
            <tr className="text-left text-[0.8125rem] text-muted">
              <th scope="col" className="pb-2 font-normal">
                Participante
              </th>
              <th scope="col" className="pb-2 font-normal">
                Acuerdo de pago
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Coste al mes
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Pagado
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Sin cubrir
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Saldo a favor
              </th>
              <th scope="col" className="pb-2 pl-4 font-normal">
                Cubierto hasta
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isLeader = member.role === "leader";
              const state = STATUS[memberState(member)];
              return (
                <tr key={member.person.id} className="border-t border-rule">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <span className="flex items-center gap-2.5">
                      <Avatar initials={member.person.initials} hue={member.person.hue} size="sm" guest={!member.person.hasAccount} />
                      <span>
                        <span className="block font-medium">{member.person.name}</span>
                        <span className="block text-[0.8125rem] text-muted">
                          {isLeader ? "Líder (tú)" : member.person.hasAccount ? "Miembro" : "Sin cuenta"}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="py-3 pr-4">{isLeader ? "Paga al proveedor" : member.agreement?.label}</td>
                  <td className="py-3 text-right">
                    <Money cents={member.share} />
                  </td>
                  <td className="py-3 text-right">{isLeader ? <span className="text-muted">—</span> : <Money cents={member.confirmedPaid} />}</td>
                  <td className="py-3 text-right">
                    {isLeader ? <span className="text-muted">—</span> : <Money cents={member.uncovered} className={member.uncovered > 0 ? "font-semibold" : ""} />}
                  </td>
                  <td className="py-3 text-right">{isLeader ? <span className="text-muted">—</span> : <Money cents={member.credit} />}</td>
                  <td className="whitespace-nowrap py-3 pl-4 tabular-nums">
                    {member.coveredThrough ? formatDay(member.coveredThrough, true) : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 text-right">
                    {isLeader ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <Pill tone={state.tone} icon={state.icon}>
                        {state.label}
                      </Pill>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col md:hidden">
        {members.map((member) => {
          const isLeader = member.role === "leader";
          const state = STATUS[memberState(member)];
          return (
            <li key={member.person.id} className="flex items-start gap-3 border-t border-rule py-3 first:border-t-0">
              <Avatar initials={member.person.initials} hue={member.person.hue} size="sm" guest={!member.person.hasAccount} />
              <div className="min-w-0 flex-1">
                <p className="text-small font-medium">{member.person.name}</p>
                <p className="text-[0.8125rem] text-muted">
                  {isLeader ? "Líder · paga al proveedor" : member.agreement?.label}
                  {member.coveredThrough ? ` · cubierto hasta ${formatDay(member.coveredThrough, true)}` : ""}
                </p>
                {!isLeader && member.credit > 0 ? (
                  <p className="text-[0.8125rem] text-muted">Saldo a favor {formatMoney(member.credit)}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Money cents={isLeader ? member.share : member.uncovered} className="text-small font-semibold" />
                <span className="text-[0.75rem] text-muted">{isLeader ? "tu parte/mes" : "sin cubrir"}</span>
                {!isLeader ? (
                  <Pill tone={state.tone} icon={state.icon}>
                    {state.label}
                  </Pill>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
