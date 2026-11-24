"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/app/(auth)/actions";
import { Field } from "@/components/molecules/Field";
import { FormMessage } from "@/components/molecules/FormMessage";
import { EMPTY_FORM_STATE } from "@/components/molecules/FormState";
import { SubmitButton } from "@/components/molecules/SubmitButton";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, EMPTY_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="siguiente" value={next} />
      <FormMessage state={state} />
      <Field label="Email" name="email" error={state.fieldErrors?.email}>
        {(props) => (
          <input {...props} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        )}
      </Field>
      <Field label="Contraseña" name="password" error={state.fieldErrors?.password}>
        {(props) => <input {...props} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/recuperar" className="text-small font-medium text-accent-ink underline-offset-4 hover:underline">
          He olvidado mi contraseña
        </Link>
      </div>
      <SubmitButton pendingLabel="Entrando…" className="w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, EMPTY_FORM_STATE);
  if (state.tone === "success") return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="¿Cómo te llamas?" name="name" error={state.fieldErrors?.name} hint="Es el nombre que verán las personas con las que compartas algo.">
        {(props) => <input {...props} name="name" autoComplete="given-name" maxLength={60} required defaultValue={state.values?.name} />}
      </Field>
      <Field label="Email" name="email" error={state.fieldErrors?.email}>
        {(props) => (
          <input {...props} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        )}
      </Field>
      <Field label="Contraseña" name="password" error={state.fieldErrors?.password} hint="Al menos 8 caracteres.">
        {(props) => <input {...props} name="password" type="password" autoComplete="new-password" minLength={8} required />}
      </Field>
      <SubmitButton pendingLabel="Creando tu cuenta…" className="w-full">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, EMPTY_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="Email de tu cuenta" name="email" error={state.fieldErrors?.email}>
        {(props) => (
          <input {...props} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        )}
      </Field>
      <SubmitButton pendingLabel="Enviando…" className="w-full">
        Enviarme el enlace
      </SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, EMPTY_FORM_STATE);
  if (state.tone === "success") {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage state={state} />
        <Link href="/" className="text-small font-semibold text-accent-ink hover:underline">
          Ir a mi resumen
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="Nueva contraseña" name="password" error={state.fieldErrors?.password} hint="Al menos 8 caracteres.">
        {(props) => <input {...props} name="password" type="password" autoComplete="new-password" minLength={8} required />}
      </Field>
      <Field label="Repítela" name="confirm" error={state.fieldErrors?.confirm}>
        {(props) => <input {...props} name="confirm" type="password" autoComplete="new-password" required />}
      </Field>
      <SubmitButton className="w-full">Guardar contraseña</SubmitButton>
    </form>
  );
}
