"use client";

import { useId, useState } from "react";
import { Avatar } from "@/components/atoms/Avatar";
import { Icon } from "@/components/atoms/Icon";
import type { Hue } from "@/lib/catalog";

/**
 * Tu nombre con un desplegable de cuenta (cerrar sesión), cerrado al empezar.
 */
export function ViewerMenu({
  name,
  initials,
  hue,
  actions,
}: {
  name: string;
  initials: string;
  hue: Hue;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-inner bg-raised">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2.5 rounded-inner p-3 text-left hover:bg-raised"
      >
        <Avatar initials={initials} hue={hue} size="md" />
        <span className="min-w-0 flex-1 truncate text-small font-semibold">{name}</span>
        <Icon name={open ? "chevronUp" : "chevronDown"} className="text-muted" />
        <span className="sr-only">: opciones de la cuenta</span>
      </button>
      {open && actions ? (
        <div id={panelId} className="px-3 pb-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
