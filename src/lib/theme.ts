/** Cookie con el tema elegido en Ajustes. Se lee en el servidor para pintar sin parpadeo. */
export const THEME_COOKIE = "tema";
export type Theme = "light" | "dark";

export function themeFrom(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}
