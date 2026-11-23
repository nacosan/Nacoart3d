import Link from "next/link";
import { HUE_DOT, HUE_STROKE } from "@/components/ui/tones";
import { CATEGORIES, HUES, type CategoryId, type Hue } from "@/lib/catalog";
import { formatMoney, type Cents, type Currency } from "@/lib/finance/money";

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Separación visible entre sectores, en unidades del círculo. */
const GAP = 3;
const RING = 10;
/** Tamaño en píxeles, en los atributos del SVG (no depende de clases CSS). */
const SIZE = 160;
/** Sectores con nombre propio; el resto se agrupa en "Otras". */
const MAX_SEGMENTS = 6;

export interface SpendItem {
  id: string;
  name: string;
  categoryId: CategoryId;
  amount: Cents;
}

interface Segment {
  key: string;
  label: string;
  amount: Cents;
  hue: Hue | null;
  href: string | null;
}

/**
 * Un color distinto por suscripción: el de su categoría si nadie lo usa aún y,
 * si no, el primero libre. "Otras" va en gris.
 */
function segmentsOf(items: SpendItem[]): Segment[] {
  const sorted = [...items].filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const named = sorted.length > MAX_SEGMENTS ? sorted.slice(0, MAX_SEGMENTS - 1) : sorted;
  const rest = sorted.slice(named.length);
  const used = new Set<Hue>();
  const segments: Segment[] = named.map((item) => {
    const preferred = CATEGORIES[item.categoryId].hue;
    const hue = used.has(preferred) ? (HUES.find((candidate) => !used.has(candidate)) ?? preferred) : preferred;
    used.add(hue);
    return { key: item.id, label: item.name, amount: item.amount, hue, href: `/suscripciones/${item.id}` };
  });
  if (rest.length > 0) {
    segments.push({
      key: "otras",
      label: `Otras (${rest.length})`,
      amount: rest.reduce((sum, item) => sum + item.amount, 0),
      hue: null,
      href: "/suscripciones",
    });
  }
  return segments;
}

/**
 * Gráfico circular del gasto al mes por suscripción, con el total en el centro
 * y la lista debajo (cada sector se nombra; no depende solo del color).
 */
export function SpendDonut({ items, currency }: { items: SpendItem[]; currency: Currency }) {
  const segments = segmentsOf(items);
  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);
  if (total === 0) return null;
  const several = segments.length > 1;

  const lengths = segments.map((segment) => (segment.amount / total) * CIRCUMFERENCE);
  const arcs = segments.map((segment, index) => {
    const dash = several ? Math.max(0.01, lengths[index] - GAP - RING) : CIRCUMFERENCE;
    const start = lengths.slice(0, index).reduce((sum, length) => sum + length, 0) + (several ? (GAP + RING) / 2 : 0);
    return { segment, dash, start };
  });

  return (
    <figure className="flex w-full flex-col items-center gap-4">
      <div className="relative flex-none">
        <svg
          viewBox="0 0 100 100"
          width={SIZE}
          height={SIZE}
          className="block"
          role="img"
          aria-label={`Gasto al mes por suscripción: ${formatMoney(total, currency)} en total.`}
        >
          {arcs.map(({ segment, dash, start }) => (
            <circle
              key={segment.key}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth={RING}
              strokeLinecap={several ? "round" : "butt"}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-start}
              transform="rotate(-90 50 50)"
              className={segment.hue ? HUE_STROKE[segment.hue] : "stroke-control"}
            >
              <title>{`${segment.label}: ${formatMoney(segment.amount, currency)}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
          <span className="text-[0.75rem] text-muted">Al mes</span>
          <span className="text-body font-bold tabular-nums">{formatMoney(total, currency)}</span>
        </div>
      </div>

      <figcaption className="w-full min-w-0">
        <ul className="flex flex-col divide-y divide-rule">
          {segments.map((segment) => (
            <li key={segment.key} className="py-1.5 first:pt-0 last:pb-0">
              <Link href={segment.href ?? "/suscripciones"} className="-mx-2 flex items-start gap-2.5 rounded-control px-2 py-1 text-small hover:bg-raised">
                <span
                  aria-hidden="true"
                  className={`mt-1 size-3 flex-none rounded-full ${segment.hue ? HUE_DOT[segment.hue] : "bg-control"}`}
                />
                <span className="min-w-0 flex-1 break-words">{segment.label}</span>
                <span className="whitespace-nowrap font-semibold tabular-nums">{formatMoney(segment.amount, currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
