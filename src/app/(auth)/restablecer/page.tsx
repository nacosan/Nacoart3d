import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Nueva contraseña · NacoArt3D" };

/** Se llega desde el enlace del correo de recuperación (ya con sesión). */
export default function NewPasswordPage() {
  return (
    <>
      <h1 className="text-title font-semibold">Elige una contraseña nueva</h1>
      <p className="mt-1 text-body text-muted">La usarás a partir de ahora para entrar.</p>
      <div className="mt-6">
        <NewPasswordForm />
      </div>
    </>
  );
}
