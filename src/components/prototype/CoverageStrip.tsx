import { Avatar } from "@/components/atoms/Avatar";
import { Icon, type IconName } from "@/components/atoms/Icon";
import type { Hue } from "@/lib/catalog";
import { formatDay, parseISODate, type ISODate } from "@/lib/finance/dates";
import type { ProviderPeriod } from "@/prototype/model";
import { SEGMENT_LABEL, type Segment, type SegmentKind } from "@/components/prototype/coverage";

/* Clases literales para que Tailwind las genere (columnas del subgrid de periodos). */
const COL_START = [
  "col-start-1",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
  "col-start-8",
  "col-start-9",
  "col-start-10",
  "col-start-11",
  "col-start-12",
];
const COL_SPAN = [
  "col-span-1",
  "col-span-1",
  "col-span-2",
  "col-span-3",
  "col-span-4",
  "col-span-5",
  "col-span-6",
  "col-span-7",
  "col-span-8",
  "col-span-9",
  "col-span-10",
  "col-span-11",
  "col-span-12",
];

const KIND_STYLE: Record<SegmentKind, { className: string; icon: IconName }> = {
  paid: { className: "bg-positive-soft text-positive-ink", icon: "check" },
  paidCredit: { className: "bg-positive-soft text-positive-ink ring-1 ring-inset ring-positive/40", icon: "coins" },
  partial: { className: "hatch bg-warning-soft text-warning-ink", icon: "half" },
  pending: { className: "border border-control bg-surface text-neutral-ink", icon: "clock" },
  awaiting: { className: "border-2 border-dashed border-accent bg-accent-soft/50 text-accent-ink", icon: "hourglass" },
  overdue: { className: "border-2 border-negative bg-negative-soft text-negative-ink", icon: "alert" },
  scheduled: { className: "border border-dashed border-control text-muted", icon: "calendar" },
  provider: { className: "bg-neutral-soft text-neutral-ink", icon: "check" },
};

export interface StripRow {
  key: string;
  name: string;
  initials: string;
  hue: Hue;
  guest: boolean;
  caption: string;
  segments: Segment[];
}

const MONTH_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function SegmentCell({ segment }: { segment: Segment }) {
  const style = KIND_STYLE[segment.kind];
  const wide = segment.span >= 3;
  return (
    <li
      title={segment.detail}
      className={`${COL_START[segment.start]} ${COL_SPAN[segment.span]} relative flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[8px] px-1.5 text-small font-medium ${style.className}`}
    >
      <Icon name={style.icon} />
      {wide ? <span className="truncate">{segment.short}</span> : null}
      <span className="sr-only">{segment.detail}</span>
    </li>
  );
}

/**
 * Tira de cobertura: una fila por participante y un segmento por plazo de su
 * acuerdo (un plazo anual es una sola barra). Se desplaza dentro de su marco
 * en pantallas estrechas; la página nunca se desplaza en horizontal.
 */
export function CoverageStrip({
  periods,
  rows,
  label,
  today,
}: {
  periods: ProviderPeriod[];
  rows: StripRow[];
  label: string;
  today: ISODate;
}) {
  const present = new Set(rows.flatMap((row) => row.segments.map((segment) => segment.kind)));
  const legend = (Object.keys(KIND_STYLE) as SegmentKind[]).filter((kind) => present.has(kind));

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[0.8125rem] text-muted xl:hidden" aria-hidden="true">
        Desliza en horizontal para ver todos los meses
        <Icon name="chevron" size="sm" />
      </p>
      <div
        className="relative -mx-5 overflow-x-auto overscroll-x-contain px-5 sm:-mx-6 sm:px-6"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <div className="min-w-[44rem]">
          <div
            aria-hidden="true"
            className="grid grid-cols-[minmax(10rem,13rem)_repeat(12,minmax(2.5rem,1fr))] gap-1 pb-2 text-[0.75rem] text-muted"
          >
            <span />
            {periods.map((period) => {
              const { year, month } = parseISODate(period.start);
              const showYear = month === 1 || period.index === 0;
              return (
                <span
                  key={period.index}
                  className={`flex flex-col items-center leading-tight ${period.current ? "font-semibold text-accent-ink" : ""}`}
                >
                  <span>{MONTH_ABBR[month - 1]}</span>
                  <span className={showYear || period.current ? "" : "invisible"}>
                    {period.current ? "hoy" : year}
                  </span>
                </span>
              );
            })}
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.key}
                className="grid grid-cols-[minmax(10rem,13rem)_repeat(12,minmax(2.5rem,1fr))] items-center gap-1"
              >
                <div className="sticky left-0 z-[1] flex min-w-0 items-center gap-2.5 bg-surface pr-2">
                  <Avatar initials={row.initials} hue={row.hue} size="sm" guest={row.guest} />
                  <div className="min-w-0">
                    <p className="truncate text-small font-semibold">{row.name}</p>
                    <p className="truncate text-[0.75rem] text-muted">{row.caption}</p>
                  </div>
                </div>
                <ol className="col-span-12 grid grid-cols-subgrid gap-1" aria-label={`Plazos de ${row.name}`}>
                  {row.segments.map((segment) => (
                    <SegmentCell key={segment.key} segment={segment} />
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-small text-muted" aria-label="Leyenda">
        {legend.map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`inline-flex h-6 w-8 items-center justify-center rounded-[6px] ${KIND_STYLE[kind].className}`}
            >
              <Icon name={KIND_STYLE[kind].icon} size="sm" />
            </span>
            {SEGMENT_LABEL[kind]}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-small text-muted">
        Cobertura económica registrada: indica lo pagado según la app, no si alguien tiene acceso al servicio. Hoy es{" "}
        {formatDay(today, true)}.
      </p>
    </div>
  );
}
