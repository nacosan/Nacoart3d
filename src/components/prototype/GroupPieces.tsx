import { Avatar } from "@/components/atoms/Avatar";
import { Icon } from "@/components/atoms/Icon";
import { Money } from "@/components/atoms/Money";
import { Panel } from "@/components/molecules/Panel";
import { Pill } from "@/components/atoms/Pill";
import { ServiceMark } from "@/components/atoms/ServiceMark";
import type { CategoryId, Hue } from "@/lib/catalog";
import { formatDay, type ISODate } from "@/lib/finance/dates";
import type { Cents } from "@/lib/finance/money";

export function GroupHeader({
  name,
  category,
  subtitle,
  finding,
  actions,
}: {
  name: string;
  category: CategoryId;
  subtitle: React.ReactNode;
  finding: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <ServiceMark name={name} category={category} size="lg" />
        <div className="min-w-0">
          <nav aria-label="Ruta" className="text-small text-muted">
            <ol className="flex items-center gap-1">
              <li>Grupos</li>
              <li aria-hidden="true">
                <Icon name="chevron" size="sm" />
              </li>
              <li aria-current="page" className="truncate">
                {name}
              </li>
            </ol>
          </nav>
          <h1 className="mt-0.5 text-title font-semibold">{name}</h1>
          <p className="text-small text-muted">{subtitle}</p>
          <p className="mt-3 max-w-[65ch] text-body">{finding}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-col gap-2 lg:items-end">{actions}</div> : null}
    </header>
  );
}

export function SplitPanel({
  price,
  participants,
  share,
  remainderHolder,
  seatsMax,
  className = "",
}: {
  price: Cents;
  participants: number;
  share: Cents;
  remainderHolder: string;
  seatsMax: number;
  className?: string;
}) {
  const remainder = price - share * participants;
  return (
    <Panel title="Reparto" titleId="reparto" className={className}>
      <p className="text-small">
        <span className="font-semibold">Igualitario entre {participants} participantes</span>, invitados sin cuenta
        incluidos.
      </p>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-body">
        <Money cents={price} /> <span className="text-muted">÷ {participants} =</span>{" "}
        <Money cents={share} className="font-semibold" />
        <span className="text-small text-muted">al mes cada uno</span>
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-small text-muted">
        <li className="flex gap-2">
          <Icon name="info" className="mt-0.5" />
          <span>
            {remainder === 0
              ? "El reparto es exacto: no sobran céntimos."
              : `${remainderHolder} asume ${remainder} ${remainder === 1 ? "céntimo" : "céntimos"} de redondeo.`}{" "}
            La regla de céntimos es del grupo: la asume {remainderHolder}.
          </span>
        </li>
        <li className="flex gap-2">
          <Icon name="info" className="mt-0.5" />
          <span>
            Se reparte entre participantes reales, no entre las {seatsMax} plazas. Las plazas libres o reservadas no
            generan coste para nadie.
          </span>
        </li>
        <li className="flex gap-2">
          <Icon name="info" className="mt-0.5" />
          <span>Un cambio de precio o de participantes aplica desde el siguiente periodo; el pasado no cambia.</span>
        </li>
      </ul>
    </Panel>
  );
}

export function ConditionsPanel({ plan, conditions, className = "" }: { plan: string; conditions: string; className?: string }) {
  return (
    <Panel title="Condiciones del plan" titleId="condiciones" className={className}>
      <p className="text-small font-semibold">{plan}</p>
      <p className="mt-2 text-small text-muted">{conditions}</p>
      <p className="mt-3">
        <Pill tone="warning" icon="info">
          Plan ficticio · sin verificar
        </Pill>
      </p>
    </Panel>
  );
}

export interface MovementRow {
  id: string;
  date: ISODate;
  concept: string;
  person?: { name: string; initials: string; hue: Hue; guest: boolean };
  amount: Cents;
  direction: "in" | "out";
  status: "declared" | "confirmed" | "rejected" | "voided";
}

const STATUS_PILL = {
  confirmed: { tone: "positive", icon: "check", label: "Confirmado" },
  declared: { tone: "accent", icon: "hourglass", label: "Por confirmar" },
  rejected: { tone: "negative", icon: "close", label: "Rechazado" },
  voided: { tone: "neutral", icon: "close", label: "Anulado" },
} as const;

export function MovementsPanel({
  title,
  rows,
  total,
  note,
  className = "",
}: {
  title: string;
  rows: MovementRow[];
  total: number;
  note?: string;
  className?: string;
}) {
  return (
    <Panel title={title} titleId="movimientos" aside={`${rows.length} de ${total}`} className={className}>
      <table className="hidden w-full text-small sm:table">
        <thead>
          <tr className="text-left text-[0.8125rem] text-muted">
            <th scope="col" className="pb-2 font-normal">
              Fecha
            </th>
            <th scope="col" className="pb-2 font-normal">
              Movimiento
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Importe
            </th>
            <th scope="col" className="pb-2 pl-4 text-right font-normal">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pill = STATUS_PILL[row.status];
            return (
              <tr key={row.id} className="border-t border-rule">
                <td className="whitespace-nowrap py-3 pr-4 tabular-nums">{formatDay(row.date, true)}</td>
                <td className="py-3 pr-4">
                  <span className="flex items-center gap-2.5">
                    {row.person ? (
                      <Avatar initials={row.person.initials} hue={row.person.hue} size="sm" guest={row.person.guest} />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.person?.name ?? row.concept}</span>
                      {row.person ? <span className="block truncate text-[0.8125rem] text-muted">{row.concept}</span> : null}
                    </span>
                  </span>
                </td>
                <td className="py-3 text-right font-semibold">
                  <Money cents={row.direction === "in" ? row.amount : -row.amount} sign="always" />
                </td>
                <td className="py-3 pl-4 text-right">
                  <Pill tone={pill.tone} icon={pill.icon}>
                    {pill.label}
                  </Pill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="flex flex-col sm:hidden">
        {rows.map((row) => {
          const pill = STATUS_PILL[row.status];
          return (
            <li key={row.id} className="flex items-start justify-between gap-3 border-t border-rule py-3 first:border-t-0">
              <div className="min-w-0">
                <p className="truncate text-small font-medium">{row.person?.name ?? row.concept}</p>
                <p className="text-[0.8125rem] text-muted">
                  {formatDay(row.date, true)}
                  {row.person ? ` · ${row.concept}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Money cents={row.direction === "in" ? row.amount : -row.amount} sign="always" className="text-small font-semibold" />
                <Pill tone={pill.tone} icon={pill.icon}>
                  {pill.label}
                </Pill>
              </div>
            </li>
          );
        })}
      </ul>
      {note ? <p className="mt-3 text-[0.8125rem] text-muted">{note}</p> : null}
    </Panel>
  );
}

export function PrototypeActionNote({ id }: { id: string }) {
  return (
    <p id={id} className="text-[0.8125rem] text-muted">
      Desactivado en el prototipo: no se guarda nada.
    </p>
  );
}
