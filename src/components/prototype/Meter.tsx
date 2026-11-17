/**
 * Barra horizontal de proporción en SVG (la anchura va en un atributo, no en
 * estilos en línea). La proporción se acota a [0, 1]; el texto la explica.
 */
export function Meter({
  ratio,
  tone = "accent",
  height = 8,
  label,
}: {
  ratio: number;
  tone?: "accent" | "ink" | "negative" | "muted";
  height?: number;
  label: string;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fill = {
    accent: "fill-accent",
    ink: "fill-ink",
    negative: "fill-negative",
    muted: "fill-control",
  }[tone];
  return (
    <svg width="100%" height={height} role="img" aria-label={label} className="block overflow-visible">
      <rect width="100%" height={height} rx={height / 2} className="fill-neutral-soft" />
      {clamped > 0 ? <rect width={`${clamped * 100}%`} height={height} rx={height / 2} className={fill} /> : null}
    </svg>
  );
}
