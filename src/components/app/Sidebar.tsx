"use client";

import { createContext, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export const SIDEBAR_COOKIE = "menu-lateral-plegado";

/** true dentro de la barra lateral plegada (fuera de ella, siempre false). */
export const SidebarCollapsedContext = createContext(false);

/**
 * Barra lateral de escritorio que se pliega a solo iconos. El estado se guarda
 * en una cookie para que el servidor la pinte igual en la siguiente carga.
 * Los hijos usan la variante `group-data-collapsed/sidebar:` para adaptarse.
 */
export function Sidebar({
  initialCollapsed,
  brand,
  children,
}: {
  initialCollapsed: boolean;
  brand: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      id="menu-lateral"
      data-collapsed={collapsed ? "" : undefined}
      className={`group/sidebar hidden flex-none flex-col gap-8 py-6 transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-dvh ${
        collapsed ? "w-20 px-3" : "w-64 px-4"
      }`}
    >
      <div className="flex items-center justify-between gap-2 group-data-collapsed/sidebar:flex-col">
        {brand}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          title={collapsed ? "Desplegar menú" : "Plegar menú"}
          className="inline-flex size-10 flex-none items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          <Icon name="sidebar" size="lg" label={collapsed ? "Desplegar menú" : "Plegar menú"} />
        </button>
      </div>
      <SidebarCollapsedContext value={collapsed}>{children}</SidebarCollapsedContext>
    </aside>
  );
}
