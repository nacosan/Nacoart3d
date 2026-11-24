import { Icon, type IconName } from "@/components/atoms/Icon";

export type Tone = "positive" | "negative" | "warning" | "neutral" | "accent" | "outline";

const TONES: Record<Tone, string> = {
  positive: "bg-positive-soft text-positive-ink",
  negative: "bg-negative-soft text-negative-ink",
  warning: "bg-warning-soft text-warning-ink",
  neutral: "bg-neutral-soft text-neutral-ink",
  accent: "bg-accent-soft text-accent-ink",
  outline: "border border-dashed border-control text-neutral-ink",
};

/** Etiqueta de estado: siempre icono + texto, nunca solo color. */
export function Pill({ tone, icon, children }: { tone: Tone; icon?: IconName; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 flex-none items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-small font-medium ${TONES[tone]}`}
    >
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </span>
  );
}
