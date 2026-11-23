"use client";

import { Icon } from "./Icon";

/**
 * Ventana modal con <dialog> nativo: gestiona el foco, se cierra con Escape,
 * con el botón de cerrar o pulsando fuera, y el fondo queda inerte.
 */
export function Modal({
  dialogRef,
  title,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClick={(event) => {
        // Pulsar fuera de la tarjeta (en la capa transparente) cierra.
        if (event.target === event.currentTarget || (event.target as HTMLElement).dataset.modalBackdrop) {
          dialogRef.current?.close();
        }
      }}
      // El <dialog> cubre toda la pantalla y es transparente; un contenedor flex
      // normal centra la tarjeta. No depende de márgenes automáticos ni de translate.
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-y-auto bg-transparent p-0 text-ink backdrop:bg-black/40"
    >
      <div data-modal-backdrop="true" className="flex min-h-full w-full items-center justify-center p-4">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-card bg-surface p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-body font-semibold">{title}</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="-mr-2 -mt-1 inline-flex size-10 flex-none items-center justify-center rounded-full hover:bg-active"
            >
              <Icon name="close" size="lg" label="Cerrar" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </dialog>
  );
}
