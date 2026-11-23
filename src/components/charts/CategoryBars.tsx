import { HUE_CLASSES, HUE_FILL } from "@/components/ui/tones";
import { Money } from "@/components/ui/Money";
import { CATEGORIES, type CategoryId } from "@/lib/catalog";
import { formatPercent, type Cents, type Currency } from "@/lib/finance/money";

export interface CategoryRow {
  category: CategoryId;
  name: string;
  amount: Cents;
  share: number | null;
}

/** Lista ordenada por importe: nombre, importe, porcentaje y una barra fina en el tono de la categoría. */
export function CategoryBars({ rows, label, currency = "EUR" }: { rows: CategoryRow[]; label: string; currency?: Currency }) {
  const largest = Math.max(0, ...rows.map((row) => row.amount));
  return (
    <ul className="flex flex-col gap-3" aria-label={label}>
      {rows.map((row) => {
        const hue = CATEGORIES[row.category].hue;
        return (
          <li key={row.category}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className={`size-2.5 flex-none rounded-full ${HUE_CLASSES[hue]}`} />
                <span className="truncate text-small">{row.name}</span>
              </span>
              <span className="flex items-baseline gap-2 text-small">
                <Money cents={row.amount} currency={currency} className="font-semibold" />
                <span className="w-12 text-right text-muted tabular-nums">{formatPercent(row.share)}</span>
              </span>
            </div>
            <svg width="100%" height="4" aria-hidden="true" className="mt-1.5 block">
              <rect
                width={`${largest === 0 ? 0 : (row.amount / largest) * 100}%`}
                height="4"
                rx="2"
                className={HUE_FILL[hue]}
              />
            </svg>
          </li>
        );
      })}
    </ul>
  );
}
