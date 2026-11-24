"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

export interface Section {
  key: string;
  label: string;
  icon: IconName;
  title: string;
  size?: "sm" | "lg";
  /** Botón redondo flotante (abajo a la derecha) en vez de ir en la barra. */
  floating?: boolean;
  content: React.ReactNode;
}

/**
 * Apartados de una suscripción: una barra de botones bajo el nombre y, para la
 * acción principal (anotar un pago), un botón redondo flotante abajo a la
 * derecha, del mismo color que el del menú (que está a la izquierda). Cada uno
 * abre su apartado en una ventana. Al guardar, la página cambia de URL
 * (?pago=1, ?cobro=1...) y las ventanas se cierran para que se vea el aviso.
 */
export function SectionActions({ sections }: { sections: Section[] }) {
  const refs = useRef(new Map<string, HTMLDialogElement | null>());
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  // Al cambiar la URL se cierran las ventanas; si trae ?abrir=<apartado>, se abre ese
  // (por ejemplo, "Añadir pago" desde el calendario).
  const requested = searchParams.get("abrir");
  useEffect(() => {
    for (const dialog of refs.current.values()) dialog?.close();
    if (requested) refs.current.get(requested)?.showModal();
  }, [pathname, query, requested]);

  if (sections.length === 0) return null;
  const inline = sections.filter((section) => !section.floating);
  const floating = sections.filter((section) => section.floating);
  const open = (key: string) => refs.current.get(key)?.showModal();
  return (
    <>
      {inline.length > 0 ? (
        <nav aria-label="Apartados de la suscripción" className="mt-5 flex flex-wrap gap-2">
          {inline.map((section) => (
            <button
              key={section.key}
              type="button"
              aria-haspopup="dialog"
              onClick={() => open(section.key)}
              className="flex h-10 items-center gap-2 rounded-full border border-border px-4 text-small font-semibold text-ink hover:bg-surface"
            >
              <Icon name={section.icon} className="text-accent-ink" />
              {section.label}
            </button>
          ))}
        </nav>
      ) : null}
      {floating.map((section) => (
        <button
          key={section.key}
          type="button"
          aria-haspopup="dialog"
          onClick={() => open(section.key)}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-20 inline-flex size-14 items-center justify-center rounded-full bg-positive text-surface shadow-lg shadow-black/20 hover:opacity-90"
        >
          <Icon name={section.icon} size="lg" label={section.label} />
        </button>
      ))}
      {sections.map((section) => (
        <ModalSlot key={section.key} section={section} register={(dialog) => refs.current.set(section.key, dialog)} />
      ))}
    </>
  );
}

function ModalSlot({ section, register }: { section: Section; register: (dialog: HTMLDialogElement | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    register(ref.current);
  }, [register]);
  return (
    <Modal dialogRef={ref} title={section.title} size={section.size}>
      {section.content}
    </Modal>
  );
}
