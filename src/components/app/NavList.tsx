import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { NavItem } from "./nav";

export function NavList({ items, current }: { items: NavItem[]; current: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const isCurrent = item.href !== null && item.href === current;
        const content = (
          <>
            <Icon name={item.icon} />
            <span className="flex-1">{item.label}</span>
            {item.count ? (
              <span className="rounded-full bg-accent-soft px-2 text-small font-semibold text-accent-ink tabular-nums">
                {item.count.value}
                <span className="sr-only"> {item.count.noun}</span>
              </span>
            ) : null}
          </>
        );
        return (
          <li key={item.label} className="relative">
            {item.href ? (
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                title={item.label}
                className={`flex h-11 items-center gap-3 rounded-full px-4 text-small transition-colors duration-150 ${
                  isCurrent ? "bg-surface font-semibold text-ink" : "text-muted hover:bg-surface/70 hover:text-ink"
                }`}
              >
                {content}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                title="No incluida en el prototipo"
                className="flex h-11 cursor-not-allowed items-center gap-3 rounded-full px-4 text-small text-muted"
              >
                {content}
                <span className="sr-only">(no incluida en el prototipo)</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
