import Link from "next/link";

/** Pantallas sin sesión: una tarjeta centrada, sin navegación. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8 flex items-center gap-2.5 rounded-control">
        <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-[14px] bg-primary font-semibold text-white">
          N
        </span>
        <span className="text-section font-semibold">NacoArt3D</span>
      </Link>
      <main id="contenido" className="w-full max-w-md rounded-card bg-surface p-6 sm:p-9">
        {children}
      </main>
      <p className="mt-6 max-w-md text-center text-small text-muted">
        Lleva la cuenta de tus suscripciones. No guardamos tarjetas ni contraseñas de ningún servicio.
      </p>
    </div>
  );
}
