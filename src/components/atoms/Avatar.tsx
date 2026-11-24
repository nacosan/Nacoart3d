import type { Hue } from "@/lib/catalog";
import { HUE_CLASSES } from "@/components/atoms/tones";

const SIZES = {
  sm: "size-7 text-[0.75rem]",
  md: "size-9 text-small",
  lg: "size-11 text-body",
} as const;

/**
 * Inicial sobre el tono pálido de la persona. Un invitado sin cuenta lleva
 * contorno discontinuo (además del texto "sin cuenta" donde se nombra).
 */
export function Avatar({
  initials,
  hue,
  size = "md",
  guest = false,
}: {
  initials: string;
  hue: Hue;
  size?: keyof typeof SIZES;
  guest?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none select-none items-center justify-center rounded-full font-semibold ${SIZES[size]} ${HUE_CLASSES[hue]} ${guest ? "outline-2 outline-offset-2 outline-dashed outline-current/50" : ""}`}
    >
      {initials}
    </span>
  );
}
