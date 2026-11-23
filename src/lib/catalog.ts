/** Tonos de identidad para personas y categorías (pares pálido / tinta en globals.css). */
export type Hue = "azul" | "verde" | "ambar" | "rosa" | "oliva" | "turquesa" | "lila";

export const HUES: readonly Hue[] = ["azul", "verde", "ambar", "rosa", "oliva", "turquesa", "lila"];

export const HUE_NAMES: Record<Hue, string> = {
  azul: "Azul",
  verde: "Verde",
  ambar: "Ámbar",
  rosa: "Rosa",
  oliva: "Oliva",
  turquesa: "Turquesa",
  lila: "Lila",
};

/** Misma lista que la tabla public.categories (migración de la fase 2). */
export type CategoryId = "video" | "musica" | "software" | "almacenamiento" | "juegos" | "noticias" | "otros";

export const CATEGORIES: Record<CategoryId, { name: string; hue: Hue }> = {
  video: { name: "Vídeo", hue: "rosa" },
  musica: { name: "Música", hue: "azul" },
  software: { name: "Software", hue: "lila" },
  almacenamiento: { name: "Almacenamiento", hue: "turquesa" },
  juegos: { name: "Juegos", hue: "oliva" },
  noticias: { name: "Noticias", hue: "ambar" },
  otros: { name: "Otros", hue: "verde" },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && value in CATEGORIES;
}

export function isHue(value: unknown): value is Hue {
  return typeof value === "string" && (HUES as readonly string[]).includes(value);
}
