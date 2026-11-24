import { HUE_DOT, HUE_STROKE } from "@/components/atoms/tones";
import type { Hue } from "@/lib/catalog";
import { formatMoney, type Cents } from "@/lib/finance/money";

export interface DonutSegment {
  key: string;
  label: string;
  value: Cents;
  hue: Hue;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Separación entre sectores, en unidades del círculo. */
const GAP = 1.5;

/**
 * Gráfico circular de anillo: un sector por elemento, ordenados de mayor a
 * menor empezando arriba. La leyenda nombra cada sector (no depende solo del
 * color) y una frase dice cuál pesa más. Sin porcentajes a la vista.
 */
export function Donut({
  segments,
  label,
  centerTop,
  centerBottom,
}: {
  segments: DonutSegment[];
  /** Nombre del gráfico para lectores de pantalla. */
  label: string;
  centerTop: React.ReactNode;
  centerBottom: React.ReactNode;
}) {
  const sorted = [...segments].filter((segment) => segment.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, segment) => sum + segment.value, 0);
  const gap = sorted.length > 1 ? GAP : 0;

  const lengths = sorted.map((segment) => (total === 0 ? 0 : (segment.value / total) * CIRCUMFERENCE));
  const arcs = sorted.map((segment, index) => ({
    ...segment,
    dash: Math.max(0, lengths[index] - gap),
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }));

  const largest = sorted[0];

  return (
    <figure className="flex flex-col items-center gap-4 @sm:flex-row @sm:items-center">
      <div className="relative size-40 flex-none">
        <svg viewBox="0 0 100 100" className="size-full" role="img" aria-label={label}>
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="14" className="stroke-neutral-soft" />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth="14"
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
              strokeDashoffset={-arc.offset}
              transform="rotate(-90 50 50)"
              className={HUE_STROKE[arc.hue]}
            >
              <title>{`${arc.label}: ${formatMoney(arc.value)}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
          <span className="text-section font-semibold tabular-nums">{centerTop}</span>
          <span className="text-[0.75rem] text-muted">{centerBottom}</span>
        </div>
      </div>

      <figcaption className="w-full min-w-0">
        <ol className="flex flex-col gap-2">
          {sorted.map((segment, index) => (
            <li key={segment.key} className="flex items-center gap-2 text-small">
              <span aria-hidden="true" className={`size-3 flex-none rounded-full ${HUE_DOT[segment.hue]}`} />
              <span className={`min-w-0 flex-1 truncate ${index === 0 ? "font-semibold" : ""}`}>{segment.label}</span>
              <span className="sr-only">: {formatMoney(segment.value)}</span>
            </li>
          ))}
        </ol>
        {largest ? (
          <p className="mt-3 text-small text-muted">
            La que más pesa es <span className="font-semibold text-ink">{largest.label}</span>:{" "}
            <span className="whitespace-nowrap tabular-nums text-ink">{formatMoney(largest.value)}</span> de{" "}
            <span className="whitespace-nowrap tabular-nums text-ink">{formatMoney(total)}</span>.
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
