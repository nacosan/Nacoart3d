"use client";

import { useRef } from "react";
import { Logo } from "@/components/atoms/Logo";
import { Icon } from "@/components/atoms/Icon";

/**
 * Navegación en un botón circular flotante (abajo a la izquierda, al alcance
 * del pulgar). Abre un panel con el logotipo, las secciones y la cuenta.
 *
 * El <dialog> cubre la pantalla de forma transparente y un contenedor flex
 * coloca el panel en la esquina (sin márgenes automáticos ni translate, que
 * fallaban en Safari). Se cierra con Escape, la X, tocando fuera o al navegar.
 */
export function FloatingMenu({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-5 z-20 inline-flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-black/20 hover:bg-primary-hover"
      >
        <Icon name="menu" size="lg" label="Abrir menú" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Menú de ManagSub"
        onClick={(event) => {
          const target = event.target as HTMLElement;
          // Fuera del panel, o un enlace dentro (al navegar), cierra.
          if (target === event.currentTarget || target.dataset.menuBackdrop || target.closest("a")) close();
        }}
        className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-black/30"
      >
        <div
          data-menu-backdrop="true"
          className="flex min-h-full w-full items-end justify-start p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xs flex-col gap-5 overflow-y-auto rounded-card bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <Logo size={32} />
              <button
                type="button"
                onClick={close}
                className="inline-flex size-10 flex-none items-center justify-center rounded-full hover:bg-active"
              >
                <Icon name="close" size="lg" label="Cerrar menú" />
              </button>
            </div>
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}
