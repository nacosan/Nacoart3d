"use client";

import { useActionState, useEffect } from "react";
import { addGuest, inviteMember, shareSubscription } from "@/app/(app)/grupos/actions";
import { Field } from "@/components/molecules/Field";
import { FormMessage } from "@/components/molecules/FormMessage";
import { EMPTY_FORM_STATE } from "@/components/molecules/FormState";
import { SubmitButton } from "@/components/molecules/SubmitButton";

export function AddGuestForm({
  subscriptionId,
  disabled,
  onDone,
}: {
  subscriptionId: string;
  disabled: boolean;
  /** Se llama al guardar con éxito (por ejemplo, para cerrar la ventana). */
  onDone?: () => void;
}) {
  const [state, action] = useActionState(addGuest.bind(null, subscriptionId), EMPTY_FORM_STATE);
  useEffect(() => {
    if (state.tone === "success") onDone?.();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.tone === "success" ? <FormMessage state={state} /> : null}
      <Field label="Alguien sin cuenta" name="guestName" error={state.fieldErrors?.guestName} hint="Solo su nombre. No necesita registrarse.">
        {(props) => (
          <input
            {...props}
            name="guestName"
            maxLength={60}
            placeholder="Nombre"
            disabled={disabled}
            defaultValue={state.tone === "success" ? "" : state.values?.guestName}
            key={state.tone === "success" ? state.message : "draft"}
          />
        )}
      </Field>
      <div>
        <SubmitButton variant="secondary" icon="plus" pendingLabel="Añadiendo…">
          Añadir
        </SubmitButton>
      </div>
    </form>
  );
}

export function InviteForm({
  subscriptionId,
  disabled,
  onDone,
}: {
  subscriptionId: string;
  disabled: boolean;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(inviteMember.bind(null, subscriptionId), EMPTY_FORM_STATE);
  useEffect(() => {
    if (state.tone === "success") onDone?.();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.tone === "success" ? <FormMessage state={state} /> : null}
      <Field
        label="Alguien con cuenta (por email)"
        name="email"
        error={state.fieldErrors?.email}
        hint="Recibirá una invitación en la app"
      >
        {(props) => (
          <input
            {...props}
            name="email"
            type="email"
            autoComplete="off"
            placeholder="email@ejemplo.com"
            disabled={disabled}
            defaultValue={state.tone === "success" ? "" : state.values?.email}
            key={state.tone === "success" ? state.message : "draft"}
          />
        )}
      </Field>
      <div>
        <SubmitButton variant="secondary" icon="send" pendingLabel="Invitando…">
          Invitar
        </SubmitButton>
      </div>
    </form>
  );
}

export function ShareForm({ subscriptionId, verifiedMax }: { subscriptionId: string; verifiedMax: number | null }) {
  const [state, action] = useActionState(shareSubscription.bind(null, subscriptionId), EMPTY_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      {verifiedMax ? (
        <p className="text-small text-muted">Este plan admite hasta {verifiedMax} personas, contándote a ti.</p>
      ) : (
        <Field label="¿Cuántas personas caben, contándote?" name="maxMembers" error={state.fieldErrors?.maxMembers}>
          {(props) => (
            <input {...props} name="maxMembers" type="number" inputMode="numeric" min={2} max={20} required defaultValue={state.values?.maxMembers} />
          )}
        </Field>
      )}
      <div>
        <SubmitButton variant="secondary" icon="users">
          Compartir esta suscripción
        </SubmitButton>
      </div>
    </form>
  );
}
