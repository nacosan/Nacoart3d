"use client";

import { useState } from "react";
import { Icon } from "@/components/atoms/Icon";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

/**
 * Interruptor de modo oscuro. Cambia el tema al momento (atributo data-theme
 * en <html>) y lo guarda en una cookie para las siguientes visitas en este
 * dispositivo.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      className="flex w-full items-center justify-between gap-4 rounded-inner border border-border bg-surface px-4 py-3 text-left hover:bg-raised"
    >
      <span className="flex items-center gap-3">
        <Icon name={dark ? "moon" : "sun"} size="lg" className="text-accent-ink" />
        <span>
          <span className="block text-body font-semibold">Modo oscuro</span>
          <span className="block text-small text-muted">{dark ? "Activado" : "Desactivado"} en este dispositivo</span>
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`inline-flex h-7 w-12 flex-none items-center rounded-full p-0.5 transition-colors duration-150 ${
          dark ? "justify-end bg-primary" : "justify-start bg-control"
        }`}
      >
        <span className="size-6 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}
