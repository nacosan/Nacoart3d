/** Tonos de identidad para personas y categorías (pares pálido / tinta en globals.css). */
export type Hue = "azul" | "verde" | "ambar" | "rosa" | "oliva" | "turquesa" | "lila";

export type CategoryId = "almacenamiento" | "video" | "musica" | "juegos";

export const CATEGORIES: Record<CategoryId, { name: string; hue: Hue }> = {
  almacenamiento: { name: "Almacenamiento", hue: "turquesa" },
  video: { name: "Vídeo", hue: "rosa" },
  musica: { name: "Música", hue: "azul" },
  juegos: { name: "Juegos", hue: "oliva" },
};
