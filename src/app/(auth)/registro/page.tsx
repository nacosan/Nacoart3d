import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/organisms/auth/AuthForms";

export const metadata: Metadata = { title: "Crear cuenta · ManagSub" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-title font-semibold">Crea tu cuenta</h1>
      <p className="mt-1 text-body text-muted">En un minuto tendrás tus suscripciones a la vista.</p>
      <div className="mt-6">
        <SignUpForm />
      </div>
      <p className="mt-6 text-center text-small text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/acceso" className="font-semibold text-accent-ink hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
