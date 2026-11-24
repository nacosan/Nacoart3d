"use client";

import { useRef } from "react";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";

/**
 * Menú del móvil en un <dialog> modal nativo: gestiona el foco, se cierra con
 * Escape y con el botón de cerrar, y el contenido de fondo queda inerte.
 */
export function MobileMenu({ title, children }: { title: string; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-active"
        aria-haspopup="dialog"
      >
        <Icon name="menu" size="lg" label="Abrir menú" />
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target === dialogRef.current || target.closest("a")) dialogRef.current?.close();
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-ground p-0 text-ink backdrop:bg-black/30"
      >
        <div className="flex h-full flex-col px-4 pb-6 pt-2">
          <div className="flex h-12 items-center justify-between">
            <Logo size={30} />
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex size-11 items-center justify-center rounded-control hover:bg-active"
            >
              <Icon name="close" size="lg" label="Cerrar menú" />
            </button>
          </div>
          <div className="mt-2 flex flex-1 flex-col overflow-y-auto">{children}</div>
        </div>
      </dialog>
    </>
  );
}
