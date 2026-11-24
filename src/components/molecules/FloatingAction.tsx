import Link from "next/link";
import { Icon, type IconName } from "@/components/atoms/Icon";

/**
 * Botón redondo verde flotante, abajo a la derecha (el menú está a la
 * izquierda): la acción principal de cada pantalla. Mismo aspecto en toda la app.
 */
export const FLOATING_ACTION_CLASSES =
  "fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-20 inline-flex size-14 items-center justify-center rounded-full bg-positive text-surface shadow-lg shadow-black/20 hover:opacity-90";

export function FloatingActionLink({ href, label, icon = "plus" }: { href: string; label: string; icon?: IconName }) {
  return (
    <Link href={href} className={FLOATING_ACTION_CLASSES}>
      <Icon name={icon} size="lg" label={label} />
    </Link>
  );
}

/** Barra de acciones secundarias bajo el título de una pantalla: botones con borde. */
export const ACTION_PILL_CLASSES =
  "flex h-10 items-center gap-2 rounded-full border border-border px-4 text-small font-semibold text-ink hover:bg-surface";

/** Variante morada para la acción principal de la pantalla. */
export const PRIMARY_PILL_CLASSES =
  "flex h-10 items-center gap-2 rounded-full border border-primary bg-primary px-4 text-small font-semibold text-white hover:bg-primary-hover";

export function ActionPillLink({
  href,
  label,
  icon,
  primary = false,
  className = "",
  ariaLabel,
}: {
  href: string;
  label: string;
  icon: IconName;
  primary?: boolean;
  className?: string;
  /** Texto completo para lectores de pantalla si la etiqueta visible es corta. */
  ariaLabel?: string;
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className={`${primary ? PRIMARY_PILL_CLASSES : ACTION_PILL_CLASSES} ${className}`}>
      <Icon name={icon} className={primary ? "" : "text-accent-ink"} />
      {label}
    </Link>
  );
}
