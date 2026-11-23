"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AddGuestForm, InviteForm } from "./GroupForms";

/** Dos botones que abren el formulario correspondiente en una ventana. */
export function AddPeople({ subscriptionId }: { subscriptionId: string }) {
  const guestRef = useRef<HTMLDialogElement>(null);
  const inviteRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button icon="plus" onClick={() => guestRef.current?.showModal()}>
          Persona sin cuenta
        </Button>
        <Button icon="send" onClick={() => inviteRef.current?.showModal()}>
          Persona con cuenta
        </Button>
      </div>
      <Modal dialogRef={guestRef} title="Añadir a alguien sin cuenta">
        <AddGuestForm subscriptionId={subscriptionId} disabled={false} onDone={() => guestRef.current?.close()} />
      </Modal>
      <Modal dialogRef={inviteRef} title="Invitar a alguien con cuenta">
        <InviteForm subscriptionId={subscriptionId} disabled={false} onDone={() => inviteRef.current?.close()} />
      </Modal>
    </>
  );
}
