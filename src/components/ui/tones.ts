import type { Hue } from "@/lib/catalog";

/** Clases literales (Tailwind solo genera las que aparecen escritas). */
export const HUE_CLASSES: Record<Hue, string> = {
  azul: "bg-azul-soft text-azul-ink",
  verde: "bg-verde-soft text-verde-ink",
  ambar: "bg-ambar-soft text-ambar-ink",
  rosa: "bg-rosa-soft text-rosa-ink",
  oliva: "bg-oliva-soft text-oliva-ink",
  turquesa: "bg-turquesa-soft text-turquesa-ink",
  lila: "bg-lila-soft text-lila-ink",
};

export const HUE_STROKE: Record<Hue, string> = {
  azul: "stroke-azul-ink",
  verde: "stroke-verde-ink",
  ambar: "stroke-ambar-ink",
  rosa: "stroke-rosa-ink",
  oliva: "stroke-oliva-ink",
  turquesa: "stroke-turquesa-ink",
  lila: "stroke-lila-ink",
};

/** Fondo sólido de la tinta del tono (puntos de leyenda). */
export const HUE_DOT: Record<Hue, string> = {
  azul: "bg-azul-ink",
  verde: "bg-verde-ink",
  ambar: "bg-ambar-ink",
  rosa: "bg-rosa-ink",
  oliva: "bg-oliva-ink",
  turquesa: "bg-turquesa-ink",
  lila: "bg-lila-ink",
};

export const HUE_FILL: Record<Hue, string> = {
  azul: "fill-azul-ink",
  verde: "fill-verde-ink",
  ambar: "fill-ambar-ink",
  rosa: "fill-rosa-ink",
  oliva: "fill-oliva-ink",
  turquesa: "fill-turquesa-ink",
  lila: "fill-lila-ink",
};
