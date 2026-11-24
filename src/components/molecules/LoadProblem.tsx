import { ButtonLink } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";

/** Aviso cuando no se pueden cargar los datos. El detalle técnico solo va al registro del servidor. */
export function LoadProblem({ status, retryHref }: { status: "setup" | "error"; retryHref: string }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-card bg-surface p-7 sm:p-9" aria-labelledby="problema">
      <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-[16px] bg-warning-soft text-warning-ink">
        <Icon name={status === "setup" ? "info" : "alert"} size="lg" />
      </span>
      <div>
        <h2 id="problema" className="text-section font-semibold">
          {status === "setup" ? "La base de datos aún no está preparada" : "No hemos podido cargar tus datos"}
        </h2>
        <p className="mt-1 max-w-[60ch] text-body text-muted">
          {status === "setup"
            ? "Falta aplicar una migración en Supabase. En cuanto esté, aquí aparecerán tus suscripciones."
            : "Puede ser un problema momentáneo de conexión. Prueba otra vez en unos segundos."}
        </p>
      </div>
      <ButtonLink href={retryHref} icon="clock">
        Reintentar
      </ButtonLink>
    </section>
  );
}
