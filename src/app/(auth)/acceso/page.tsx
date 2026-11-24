import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/organisms/auth/AuthForms";
import { Icon } from "@/components/atoms/Icon";
import { safeNext } from "@/lib/redirects";

export const metadata: Metadata = { title: "Entrar · ManagSub" };

export default async function SignInPage(props: PageProps<"/acceso">) {
  const params = await props.searchParams;
  const next = safeNext(params.siguiente);
  const expired = params.enlace === "caducado";
  return (
    <>
      <h1 className="text-title font-semibold">Hola de nuevo</h1>
      <p className="mt-1 text-body text-muted">Entra para ver tus suscripciones.</p>
      {expired ? (
        <p className="mt-5 flex items-start gap-2 rounded-inner bg-warning-soft px-4 py-3 text-small text-warning-ink">
          <Icon name="info" className="mt-0.5" />
          El enlace no es válido o ha caducado. Inicia sesión o pide uno nuevo.
        </p>
      ) : null}
      <div className="mt-6">
        <SignInForm next={next} />
      </div>
      <p className="mt-6 text-center text-small text-muted">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-accent-ink hover:underline">
          Crear una
        </Link>
      </p>
    </>
  );
}
