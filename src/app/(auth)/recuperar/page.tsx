import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Recuperar contraseña · ManagSub" };

export default function ResetRequestPage() {
  return (
    <>
      <h1 className="text-title font-semibold">¿Olvidaste tu contraseña?</h1>
      <p className="mt-1 text-body text-muted">Te enviamos un enlace para elegir una nueva.</p>
      <div className="mt-6">
        <ResetRequestForm />
      </div>
      <p className="mt-6 text-center text-small">
        <Link href="/acceso" className="font-semibold text-accent-ink hover:underline">
          Volver a entrar
        </Link>
      </p>
    </>
  );
}
