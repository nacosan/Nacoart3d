"use client";

import { useState } from "react";
import { Icon } from "@/components/atoms/Icon";

/**
 * Fila de acciones del Resumen con un botón "N pagos por anotar" al final.
 * Al pulsarlo se despliega debajo la lista de esos pagos.
 */
export function PendingToggle({ actions, label, list }: { actions: React.ReactNode; label: string; list: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5">
      <nav aria-label="Acciones" className="flex gap-2 overflow-x-auto">
        {actions}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="pagos-por-anotar"
          onClick={() => setOpen(!open)}
          className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-warning-line/50 bg-warning-soft px-4 text-small font-semibold text-warning-ink"
        >
          <Icon name="info" />
          {label}
          <Icon name="chevronDown" className={open ? "rotate-180" : ""} />
        </button>
      </nav>
      {open ? (
        <div id="pagos-por-anotar" className="mt-3 max-w-md">
          {list}
        </div>
      ) : null}
    </div>
  );
}
