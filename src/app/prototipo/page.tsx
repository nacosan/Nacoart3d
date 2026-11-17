import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { SegmentedLinks } from "@/components/ui/SegmentedLinks";
import { ServiceMark } from "@/components/ui/ServiceMark";
import { CategoryBars } from "@/components/prototype/CategoryBars";
import { ColumnChart } from "@/components/prototype/ColumnChart";
import { Donut } from "@/components/prototype/Donut";
import { CATEGORIES } from "@/lib/catalog";
import { Meter } from "@/components/prototype/Meter";
import { PrototypeNotice } from "@/components/prototype/PrototypeNotice";
import { leaderNav } from "@/components/prototype/navigation";
import { formatDay, formatMonthLong, formatMonthShort, parseISODate } from "@/lib/finance/dates";
import { formatMoney, formatPercent, percentOf, sumCents } from "@/lib/finance/money";
import { PEOPLE } from "@/prototype/data";
import {
  BUDGET_MONTHLY,
  TODAY,
  anaCashEntries,
  anaItems,
  anaMissingRenewals,
  anaReceivables,
  anaUpcoming,
  categoryTotals,
  filterItems,
  monthlyCash,
  ondas,
  type KindFilter,
  type Receivable,
  type SubscriptionItem,
} from "@/prototype/model";

type View = "mi-parte" | "completo" | "lidero";

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function href(view: View, kind: KindFilter) {
  const params = new URLSearchParams();
  if (view !== "mi-parte") params.set("vista", view);
  if (kind !== "todas") params.set("tipo", kind);
  const query = params.toString();
  return query ? `/prototipo?${query}` : "/prototipo";
}

const ROLE_LABEL = { holder: "Personal", leader: "Lideras", member: "Miembro" } as const;

function firstName(name: string) {
  return name.split(" ")[0];
}

function finding(kind: KindFilter): string {
  if (kind === "personal") {
    const missing = anaMissingRenewals()[0];
    return missing
      ? `${missing.name}: la renovación del ${formatDay(missing.date, true)} no tiene pago registrado.`
      : "Tus suscripciones personales están al día.";
  }
  const receivables = anaReceivables();
  const overdue = receivables.find((row) => row.state === "overdue");
  const awaiting = receivables.find((row) => row.state === "awaiting");
  const parts: string[] = [];
  if (overdue) {
    const ledger = ondas.members.find((member) => member.person.id === overdue.person.id);
    parts.push(
      `${firstName(overdue.person.name)} tiene ${formatMoney(overdue.amount)} vencidos en ${ondas.spec.name}${
        ledger?.oldestOverdueSince ? ` desde el ${formatDay(ledger.oldestOverdueSince)}` : ""
      }.`,
    );
  }
  if (awaiting) parts.push(`${firstName(awaiting.person.name)} declaró un pago de ${formatMoney(awaiting.amount)} por confirmar.`);
  return parts.join(" ") || "No tienes cobros pendientes.";
}

export default async function SummaryPage(props: PageProps<"/prototipo">) {
  const params = await props.searchParams;
  const view = pick(params.vista, ["mi-parte", "completo", "lidero"] as const, "mi-parte");
  const kind = view === "lidero" ? "todas" : pick(params.tipo, ["todas", "personal", "compartida"] as const, "todas");
  const items = filterItems(anaItems, kind);
  const ana = PEOPLE.ana;

  return (
    <AppShell
      nav={leaderNav}
      current="/prototipo"
      viewer={{ name: ana.name, initials: ana.initials, hue: ana.hue }}
      screenTitle="Resumen"
      notice={<PrototypeNotice current="/prototipo" />}
    >
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-title font-semibold">Resumen</h1>
            <p className="mt-1 max-w-[65ch] text-body text-muted">{finding(kind)}</p>
          </div>
          <SegmentedLinks
            label="Vista del resumen"
            options={[
              { href: href("mi-parte", kind), label: "Mi parte", current: view === "mi-parte" },
              { href: href("completo", kind), label: "Importe completo", current: view === "completo" },
              { href: href("lidero", "todas"), label: "Grupos que lidero", current: view === "lidero" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {view !== "lidero" ? (
            <SegmentedLinks
              label="Tipo de suscripción"
              options={[
                { href: href(view, "todas"), label: "Todas", current: kind === "todas" },
                { href: href(view, "personal"), label: "Personales", current: kind === "personal" },
                { href: href(view, "compartida"), label: "Compartidas", current: kind === "compartida" },
              ]}
            />
          ) : null}
          <p className="flex items-center gap-1.5 text-small text-muted">
            <Icon name="calendar" />
            Periodo: {formatMonthLong(TODAY)} (hasta el {formatDay(TODAY)})
          </p>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6">
          {view === "lidero" ? <TreasuryCard /> : <TotalsCard items={items} view={view} kind={kind} />}
        </div>

        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
          {view === "lidero" ? (
            <>
              <ReceivablesPanel rows={anaReceivables()} />
              <UpcomingPanel kind="compartida" leaderOnly />
              <CollectionsChart />
            </>
          ) : (
            <>
              <UpcomingPanel kind={kind} wide />
              {kind !== "personal" ? <ReceivablesPanel rows={anaReceivables()} /> : null}
              <Panel
                title="Distribución por categoría"
                titleId="categorias"
                aside={view === "completo" ? "Importe completo al mes" : "Tu parte al mes"}
                className={kind === "personal" ? "xl:col-span-2" : ""}
              >
                <CategoryBars
                  label="Distribución por categoría"
                  rows={categoryTotals(items, view === "completo" ? "fullMonthly" : "myMonthly")}
                />
              </Panel>
              <SpendChart kind={kind} />
              {kind !== "compartida" ? <MissingPanel /> : null}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function TotalsCard({ items, view, kind }: { items: SubscriptionItem[]; view: View; kind: KindFilter }) {
  const full = view === "completo";
  const monthly = sumCents(items.map((item) => (full ? item.fullMonthly : item.myMonthly)));
  const annual = sumCents(items.map((item) => (full ? item.fullAnnual : item.myAnnual)));
  const groups = categoryTotals(items, full ? "fullMonthly" : "myMonthly");
  const budgetShare = percentOf(monthly, BUDGET_MONTHLY);

  return (
    <Panel title={full ? "Importe completo al mes" : "Mi parte al mes"} titleId="total">
      {full ? (
        <p className="-mt-2 mb-3">
          <Pill tone="warning" icon="info">
            No es tu gasto personal
          </Pill>
        </p>
      ) : null}
      <p className="text-figure font-semibold">
        <Money cents={monthly} />
      </p>
      <p className="mt-1 text-small text-muted">
        Coste mensual equivalente{full ? " de los planes completos, contando cada uno una vez" : ""}. Equivale a{" "}
        <Money cents={annual} className="font-semibold text-ink" /> al año.
      </p>

      {!full && kind === "todas" ? (
        <div className="mt-5 rounded-inner bg-raised p-4">
          <div className="flex items-baseline justify-between gap-3 text-small">
            <span>Presupuesto mensual</span>
            <span className="text-muted">
              <span className="font-semibold text-ink tabular-nums">{formatPercent(budgetShare)}</span> de{" "}
              <Money cents={BUDGET_MONTHLY} />
            </span>
          </div>
          <div className="mt-2">
            <Meter
              ratio={monthly / BUDGET_MONTHLY}
              tone={monthly > BUDGET_MONTHLY ? "negative" : "ink"}
              label={`${formatPercent(budgetShare)} del presupuesto mensual`}
            />
          </div>
          <p className="mt-2 text-small text-muted">
            {monthly <= BUDGET_MONTHLY ? (
              <>
                Margen de <Money cents={BUDGET_MONTHLY - monthly} className="text-ink" /> en equivalente mensual.
              </>
            ) : (
              <>
                Superas el presupuesto en <Money cents={monthly - BUDGET_MONTHLY} className="text-negative" />.
              </>
            )}
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="@container mt-6">
          <Donut
            label={`Reparto de ${full ? "los importes completos" : "tu parte"} al mes por suscripción`}
            centerTop={items.length}
            centerBottom={items.length === 1 ? "suscripción" : "suscripciones"}
            segments={items.map((item) => ({
              key: item.id,
              label: item.name,
              value: full ? item.fullMonthly : item.myMonthly,
              hue: CATEGORIES[item.category].hue,
            }))}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-6 rounded-inner border border-dashed border-control p-4 text-small text-muted">
          No hay suscripciones de este tipo.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-5 border-t border-rule pt-5">
          {groups.map((group) => (
            <li key={group.category}>
              <div className="flex items-baseline justify-between text-small">
                <h3 className="font-semibold">{group.name}</h3>
                <Money cents={group.amount} className="font-semibold" />
              </div>
              <ul className="mt-2 flex flex-col gap-3">
                {group.items.map((item) => {
                  const value = full ? item.fullMonthly : item.myMonthly;
                  const name = item.href ? (
                    <Link href={item.href} className="hover:underline">
                      {item.name}
                    </Link>
                  ) : (
                    item.name
                  );
                  return (
                    <li key={item.id} className="flex items-center gap-3">
                      <ServiceMark name={item.name} category={item.category} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-medium">{name}</p>
                        <p className="truncate text-[0.8125rem] text-muted">
                          {ROLE_LABEL[item.role]} ·{" "}
                          {item.period === "yearly" ? (
                            <>
                              <Money cents={item.fullAmount} /> al año
                            </>
                          ) : item.kind === "shared" && !full ? (
                            <>
                              tu parte de <Money cents={item.fullAmount} />
                            </>
                          ) : item.kind === "shared" ? (
                            <>
                              tu parte <Money cents={item.myAmount} />
                            </>
                          ) : (
                            "mensual"
                          )}
                        </p>
                      </div>
                      <Money cents={value} className="text-small font-semibold" />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {items.some((item) => item.period === "yearly") ? (
        <p className="mt-5 text-[0.8125rem] text-muted">
          Los planes anuales cuentan su importe entre 12, redondeado al céntimo. No es dinero cobrado cada mes.
        </p>
      ) : null}
    </Panel>
  );
}

function TreasuryCard() {
  const t = ondas.treasury;
  const payments = ondas.spec.providerPayments;
  const firstMonth = formatMonthLong(payments[0].occurredOn).split(" ")[0];
  const lastMonth = formatMonthLong(payments[payments.length - 1].occurredOn).split(" ")[0];
  const prepaidBy = ondas.members
    .filter((member) => member.prepaid > 0)
    .map((member) =>
      member.credit > 0
        ? `saldo a favor de ${firstName(member.person.name)} (${formatMoney(member.credit)})`
        : `plazo anual de ${firstName(member.person.name)} (${formatMoney(member.prepaid)} de meses futuros)`,
    );
  const rows = [
    { label: "Pagado al proveedor", value: t.paidProvider, hint: `${payments.length} pagos, de ${firstMonth} a ${lastMonth}` },
    { label: "Cobrado a participantes", value: t.collected, hint: "Solo cobros confirmados" },
  ];
  return (
    <Panel title="Grupos que lidero" titleId="tesoreria">
      <div className="flex items-center gap-3">
        <ServiceMark name={ondas.spec.name} category={ondas.spec.category} />
        <div className="min-w-0">
          <Link href="/prototipo/grupos/ondas" className="text-small font-semibold hover:underline">
            {ondas.spec.name}
          </Link>
          <p className="text-[0.8125rem] text-muted">Desde el {formatDay(ondas.spec.anchor, true)}</p>
        </div>
      </div>
      <p className="mt-5 text-small text-muted">Adelanto neto</p>
      <p className="text-figure font-semibold">
        <Money cents={t.net} />
      </p>
      <p className="text-small text-muted">Lo que has puesto tú de más hasta hoy: pagado menos cobrado.</p>
      <dl className="mt-5 flex flex-col divide-y divide-rule">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-small">
              {row.label}
              <span className="block text-[0.8125rem] text-muted">{row.hint}</span>
            </dt>
            <dd>
              <Money cents={row.value} className="text-small font-semibold" />
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-inner bg-raised p-4 text-small">
        <p className="font-semibold">Por qué son {formatMoney(t.net)}</p>
        <dl className="mt-2 flex flex-col gap-1.5">
          <div className="flex justify-between gap-3">
            <dt>
              Tu parte ({ondas.snapshotCount} meses ×{" "}
              {formatMoney(ondas.members.find((member) => member.role === "leader")?.share ?? 0)})
            </dt>
            <dd>
              <Money cents={t.leaderShare} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>+ Coste de otros aún sin cubrir</dt>
            <dd>
              <Money cents={t.uncovered} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>− Cobrado por adelantado</dt>
            <dd>
              <Money cents={t.prepaid} />
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-rule pt-1.5 font-semibold">
            <dt>= Adelanto neto</dt>
            <dd>
              <Money cents={t.net} />
            </dd>
          </div>
        </dl>
        {prepaidBy.length > 0 ? (
          <p className="mt-2 text-[0.8125rem] text-muted">
            Cobrado por adelantado: {prepaidBy.join(" y ")}. No es un ingreso: corresponde a plazos futuros.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function UpcomingPanel({
  kind,
  leaderOnly = false,
  wide = false,
}: {
  kind: KindFilter;
  leaderOnly?: boolean;
  wide?: boolean;
}) {
  const rows = anaUpcoming(kind).filter((row) => !leaderOnly || row.label === "Pago al proveedor previsto");
  const shown = rows.slice(0, 5);
  return (
    <Panel
      title="Próximos pagos y renovaciones"
      titleId="proximos"
      aside="Próximos 45 días · previsiones"
      className={wide ? "xl:col-span-2" : ""}
    >
      {shown.length === 0 ? (
        <p className="rounded-inner border border-dashed border-control p-4 text-small text-muted">
          No hay pagos ni renovaciones previstos en los próximos 45 días.
        </p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((row) => {
            const { day } = parseISODate(row.date);
            return (
              <li key={row.id} className="flex items-center gap-3 border-b border-rule py-3 last:border-b-0">
                <span className="flex w-10 flex-none flex-col items-center leading-tight">
                  <span className="text-body font-semibold tabular-nums">{day}</span>
                  <span className="text-[0.75rem] text-muted">{formatMonthShort(row.date).split(" ")[0]}</span>
                </span>
                <ServiceMark name={row.name} category={row.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-medium">
                    {row.href ? (
                      <Link href={row.href} className="hover:underline">
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </p>
                  <p className="text-[0.8125rem] text-muted">{row.label}</p>
                </div>
                <div className="text-right">
                  <Money cents={row.amount} className="text-small font-semibold" />
                  {row.myPart !== null ? (
                    <p className="text-[0.8125rem] text-muted">
                      tu parte <Money cents={row.myPart} />
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > shown.length ? (
        <p className="mt-3 text-small text-muted">
          y {rows.length - shown.length} más en este periodo.
        </p>
      ) : null}
      <p className="mt-3 text-[0.8125rem] text-muted">
        Son fechas del calendario contratado, no pagos. Un pago solo cuenta cuando se registra.
      </p>
    </Panel>
  );
}

const RECEIVABLE_PILL = {
  overdue: { tone: "negative", icon: "alert", label: "Vencido" },
  awaiting: { tone: "accent", icon: "hourglass", label: "Por confirmar" },
  notDue: { tone: "neutral", icon: "clock", label: "En plazo" },
} as const;

function ReceivablesPanel({ rows }: { rows: Receivable[] }) {
  const t = ondas.treasury;
  return (
    <Panel title="Pendiente de cobro" titleId="por-cobrar" aside={ondas.spec.name}>
      <p className="text-figure font-semibold">
        <Money cents={t.uncovered} />
      </p>
      <p className="text-small text-muted">
        <Money cents={t.uncoveredOverdue} className="text-ink" /> vencido · <Money cents={t.uncoveredAwaiting} className="text-ink" />{" "}
        por confirmar · <Money cents={t.uncoveredNotDue} className="text-ink" /> aún no vence
      </p>
      <ul className="mt-4 flex flex-col">
        {rows.map((row) => {
          const pill = RECEIVABLE_PILL[row.state];
          return (
            <li key={row.person.id} className="flex items-center gap-3 border-b border-rule py-3 last:border-b-0">
              <Avatar initials={row.person.initials} hue={row.person.hue} size="sm" guest={!row.person.hasAccount} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium">{row.person.name}</p>
                <p className="text-[0.8125rem] text-muted">
                  {row.detail}
                  {row.daysOverdue !== null ? ` · hace ${row.daysOverdue} días` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Money cents={row.amount} className="text-small font-semibold" />
                <Pill tone={pill.tone} icon={pill.icon}>
                  {pill.label}
                </Pill>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <ButtonLink href="/prototipo/grupos/ondas" icon="chevron">
          Revisar en el grupo
        </ButtonLink>
      </div>
    </Panel>
  );
}

function MissingPanel() {
  const missing = anaMissingRenewals();
  return (
    <Panel title="Renovaciones sin pago registrado" titleId="sin-pago" className="xl:col-span-2">
      {missing.length === 0 ? (
        <p className="text-small text-muted">Todas las renovaciones pasadas tienen su pago registrado.</p>
      ) : (
        <ul className="flex flex-col">
          {missing.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 border-b border-rule py-3 last:border-b-0">
              <ServiceMark name={row.name} category={row.category} />
              <div className="min-w-0 flex-1">
                <p className="text-small font-medium">{row.name}</p>
                <p className="text-[0.8125rem] text-muted">Renovación del {formatDay(row.date, true)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Money cents={row.amount} className="text-small font-semibold" />
                <Pill tone="warning" icon="info">
                  Sin pago registrado
                </Pill>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[0.8125rem] text-muted">
        No es una deuda: el calendario siguió avanzando, pero nadie anotó el pago de esa fecha.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button icon="plus" disabled describedBy="sin-pago-proto">
          Registrar pago
        </Button>
        <span id="sin-pago-proto" className="text-[0.8125rem] text-muted">
          Desactivado en el prototipo.
        </span>
      </div>
    </Panel>
  );
}

function SpendChart({ kind }: { kind: KindFilter }) {
  const months = monthlyCash(anaCashEntries(), kind);
  const current = months[months.length - 1];
  return (
    <Panel title="Gasto real registrado" titleId="gasto-real" aside="Últimos 12 meses · neto" className="xl:col-span-2">
      <ColumnChart
        caption={`Neto mensual: lo que salió de tu bolsillo menos los reembolsos recibidos. ${formatMonthLong(current.start)}, hasta hoy: salieron ${formatMoney(current.out)}, te reembolsaron ${formatMoney(current.in)}, neto ${formatMoney(current.net)}. No incluye previsiones.`}
        columns={months.map((month) => ({
          key: month.month,
          label: formatMonthShort(month.start).split(" ")[0],
          longLabel: formatMonthLong(month.start),
          value: Math.max(0, month.net),
          highlight: month.month === current.month,
        }))}
      />
    </Panel>
  );
}

function CollectionsChart() {
  const months = monthlyCash(anaCashEntries(), "compartida");
  const current = months[months.length - 1];
  const awaiting = anaReceivables().filter((row) => row.state === "awaiting");
  const awaitingNote =
    awaiting.length > 0
      ? ` Los pagos declarados por ${awaiting.map((row) => firstName(row.person.name)).join(" y ")} (${formatMoney(
          sumCents(awaiting.map((row) => row.amount)),
        )}) no cuentan hasta que los confirmes.`
      : "";
  return (
    <Panel title="Cobros confirmados" titleId="cobros" aside={`${ondas.spec.name} · últimos 12 meses`} className="xl:col-span-2">
      <ColumnChart
        caption={`Reembolsos confirmados de los participantes por mes. ${formatMonthLong(current.start)}, hasta hoy: ${formatMoney(current.in)}.${awaitingNote}`}
        columns={months.map((month) => ({
          key: month.month,
          label: formatMonthShort(month.start).split(" ")[0],
          longLabel: formatMonthLong(month.start),
          value: month.in,
          highlight: month.month === current.month,
        }))}
      />
    </Panel>
  );
}
