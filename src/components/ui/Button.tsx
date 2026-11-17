import Link from "next/link";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-[#33373b] active:bg-black",
  secondary: "bg-surface text-ink border border-control hover:bg-raised active:bg-active",
  ghost: "text-ink hover:bg-active active:bg-[#dcdfe3]",
};

const BASE =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 text-small font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:border-border disabled:bg-active disabled:text-muted";

export function Button({
  variant = "secondary",
  icon,
  children,
  disabled,
  describedBy,
  type = "button",
}: {
  variant?: Variant;
  icon?: IconName;
  children: React.ReactNode;
  disabled?: boolean;
  /** Id del texto que explica por qué está desactivado. */
  describedBy?: string;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} disabled={disabled} aria-describedby={describedBy} className={`${BASE} ${VARIANTS[variant]}`}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  icon,
  children,
}: {
  href: string;
  variant?: Variant;
  icon?: IconName;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]}`}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}
