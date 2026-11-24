"use client";

import Link from "next/link";
import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { FLOATING_ACTION_CLASSES } from "@/components/ui/FloatingAction";
import { Modal } from "@/components/ui/Modal";
import { ServiceMark } from "@/components/ui/ServiceMark";
import type { CategoryId } from "@/lib/catalog";

export interface QuickPayOption {
  id: string;
  /** Nombre personalizado o, si no hay, el del servicio. */
  title: string;
  serviceName: string;
  categoryId: CategoryId;
  href: string;
}

/**
 * Botón "+" flotante del Resumen: pregunta para qué suscripción es el pago y
 * lleva a su formulario. Mismo aspecto que el de una suscripción.
 */
export function QuickPay({ options }: { options: QuickPayOption[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  if (options.length === 0) return null;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className={FLOATING_ACTION_CLASSES}
      >
        <Icon name="plus" size="lg" label="Anotar un pago" />
      </button>
      <Modal dialogRef={dialogRef} title="¿De qué suscripción es el pago?">
        <ul className="flex flex-col gap-1">
          {options.map((option) => (
            <li key={option.id}>
              <Link
                href={option.href}
                onClick={() => dialogRef.current?.close()}
                className="-mx-2 flex items-center gap-3 rounded-inner px-2 py-2 hover:bg-raised"
              >
                <ServiceMark name={option.serviceName} category={option.categoryId} />
                <span className="min-w-0 flex-1 truncate text-small font-semibold">{option.title}</span>
                <Icon name="chevron" className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
