"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/(app)/ajustes/actions";
import { Field } from "@/components/forms/Field";
import { FormMessage } from "@/components/forms/FormMessage";
import { EMPTY_FORM_STATE } from "@/components/forms/FormState";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { HUE_CLASSES } from "@/components/ui/tones";
import { HUE_NAMES, HUES } from "@/lib/catalog";
import { TIMEZONES } from "@/lib/time";

export interface ProfileValues {
  displayName: string;
  avatarHue: string;
  currency: string;
  timezone: string;
  budget: string;
}

export function ProfileForm({ initial, disabled }: { initial: ProfileValues; disabled: boolean }) {
  const [state, action] = useActionState(updateProfile, EMPTY_FORM_STATE);
  const v = { ...initial, ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessage state={state} />
      <fieldset disabled={disabled} className="flex flex-col gap-6 disabled:opacity-60">
        <Field label="Tu nombre" name="displayName" error={e.displayName}>
          {(props) => <input {...props} name="displayName" maxLength={60} required autoComplete="name" defaultValue={v.displayName} />}
        </Field>

        <fieldset aria-describedby={e.avatarHue ? "campo-avatarHue-error" : undefined}>
          <legend className="mb-2 text-small font-semibold">Color de tu inicial</legend>
          <div className="flex flex-wrap gap-2">
            {HUES.map((hue) => (
              <label
                key={hue}
                className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-transparent pl-1.5 pr-4 text-small has-checked:border-ink has-focus-visible:outline-2 has-focus-visible:outline-accent ${HUE_CLASSES[hue]}`}
              >
                <input type="radio" name="avatarHue" value={hue} defaultChecked={v.avatarHue === hue} className="sr-only" />
                <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-surface/60 font-semibold">
                  {v.displayName.charAt(0).toLocaleUpperCase("es-ES") || "A"}
                </span>
                {HUE_NAMES[hue]}
              </label>
            ))}
          </div>
          {e.avatarHue ? (
            <p id="campo-avatarHue-error" className="mt-1.5 text-small font-medium text-negative-ink">
              {e.avatarHue}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Moneda principal" name="currency" error={e.currency} hint="Los totales se muestran en esta moneda.">
            {(props) => (
              <select {...props} name="currency" defaultValue={v.currency}>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            )}
          </Field>
          <Field label="Zona horaria" name="timezone" error={e.timezone} hint="Para saber qué día es hoy para ti.">
            {(props) => (
              <select {...props} name="timezone" defaultValue={v.timezone}>
                {TIMEZONES.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field
          label="Presupuesto mensual"
          name="budget"
          error={e.budget}
          optional
          hint="Cuánto quieres gastar como mucho al mes en suscripciones. Déjalo vacío si no quieres usarlo."
        >
          {(props) => <input {...props} name="budget" inputMode="decimal" placeholder="60,00" defaultValue={v.budget} />}
        </Field>

        <div>
          <SubmitButton icon="check">Guardar ajustes</SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
