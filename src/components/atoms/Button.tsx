import Link from "next/link";
import { Icon, type IconName } from "@/components/atoms/Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover",
  secondary: "bg-surface text-ink border border-border hover:bg-raised active:bg-active",
  ghost: "text-ink hover:bg-active active:bg-active",
  danger: "bg-surface text-negative-ink border border-negative/40 hover:bg-negative-soft",
};

const BASE =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-small font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:border-border disabled:bg-active disabled:text-muted";

export function buttonClasses(variant: Variant = "secondary", extra = "") {
  return `${BASE} ${VARIANTS[variant]} ${extra}`;
}

export function Button({
  variant = "secondary",
  icon,
  children,
  disabled,
  describedBy,
  type = "button",
  name,
  value,
  className = "",
  onClick,
}: {
  variant?: Variant;
  icon?: IconName;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Id del texto que explica por qué está desactivado. */
  describedBy?: string;
  type?: "button" | "submit";
  name?: string;
  value?: string;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-describedby={describedBy}
      name={name}
      value={value}
      onClick={onClick}
      className={buttonClasses(variant, className)}
    >
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
  className = "",
}: {
  href: string;
  variant?: Variant;
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, className)}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}
