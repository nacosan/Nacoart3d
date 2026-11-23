import { formatMoney, type Cents, type Currency } from "@/lib/finance/money";

export interface Column {
  key: string;
  label: string;
  /** Etiqueta completa para la tabla accesible. */
  longLabel: string;
  value: Cents;
  highlight?: boolean;
}

function axisFormat(currency: Currency) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0, useGrouping: "always" });
}

/** Máximo "redondo" divisible en 4 tramos iguales (1, 2, 2,5 o 5 × 10^n por tramo). */
function niceTop(max: Cents): Cents {
  if (max <= 0) return 400;
  const rawStep = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rawStep) ?? 10 * magnitude;
  return Math.ceil(step / 100) * 100 * 4;
}

const TICKS = [
  { fraction: 1, className: "top-0" },
  { fraction: 0.75, className: "top-1/4" },
  { fraction: 0.5, className: "top-1/2" },
  { fraction: 0.25, className: "top-3/4" },
  { fraction: 0, className: "top-full" },
];

/**
 * Columnas de un solo tono con escala y 5 líneas de referencia. La columna
 * destacada (el mes en curso) usa la tinta oscura del acento y se rotula.
 */
export function ColumnChart({ columns, caption, currency = "EUR" }: { columns: Column[]; caption: string; currency?: Currency }) {
  const axis = axisFormat(currency);
  const max = Math.max(0, ...columns.map((column) => column.value));
  const top = niceTop(max);

  return (
    <figure>
      <div className="relative ml-14 h-44" aria-hidden="true">
        {TICKS.map((tick) => (
          <div key={tick.fraction} className={`absolute inset-x-0 ${tick.className} border-t border-rule`}>
            <span className="absolute -left-14 w-12 -translate-y-1/2 text-right text-[0.75rem] text-muted tabular-nums">
              {axis.format((top * tick.fraction) / 100)}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
          {columns.map((column) => {
            const pct = top === 0 ? 0 : (column.value / top) * 100;
            return (
              <svg
                key={column.key}
                viewBox="0 0 10 100"
                preserveAspectRatio="none"
                className="h-full min-w-0 flex-1 overflow-visible"
              >
                <rect
                  x="1"
                  width="8"
                  y={100 - pct}
                  height={pct}
                  className={column.highlight ? "fill-accent-ink" : "fill-accent"}
                />
              </svg>
            );
          })}
        </div>
      </div>
      <div className="ml-14 mt-2 flex gap-1 sm:gap-2" aria-hidden="true">
        {columns.map((column, index) => (
          <span
            key={column.key}
            className={`min-w-0 flex-1 truncate text-center text-[0.75rem] ${column.highlight ? "font-semibold text-accent-ink" : "text-muted"} ${
              // En pantallas estrechas, un mes de cada dos (contando hacia atrás desde el actual).
              (columns.length - 1 - index) % 2 === 1 && !column.highlight ? "max-sm:invisible" : ""
            }`}
          >
            {column.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 text-small text-muted">{caption}</figcaption>
      {/* Una <table> no se encoge con sr-only: se oculta su contenedor. */}
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Importe</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.key}>
              <th scope="row">{column.longLabel}</th>
              <td>{formatMoney(column.value, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
