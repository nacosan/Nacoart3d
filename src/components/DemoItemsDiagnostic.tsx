import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type DemoItem = {
  id: number;
  name: string;
  created_at: string;
};

type DiagnosticResult =
  | { status: "ok"; items: DemoItem[] }
  | { status: "empty" }
  | { status: "error"; message: string };

// Mensajes públicos: nunca se muestra el error interno en la interfaz.
const ERROR_MESSAGES = {
  config: "Falta la configuración de Supabase en el servidor.",
  missingTable: "La tabla de demostración todavía no existe en la base de datos.",
  permission: "No hay permiso para leer los datos de demostración.",
  generic: "No se pudo completar la consulta a la base de datos.",
} as const;

async function loadDemoItems(): Promise<DiagnosticResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    // Deja pasar las señales internas de Next.js (p. ej. renderizado dinámico).
    unstable_rethrow(error);
    console.error("[diagnóstico] configuración de Supabase:", error);
    return { status: "error", message: ERROR_MESSAGES.config };
  }

  try {
    const { data, error } = await supabase
      .from("demo_items")
      .select("id, name, created_at")
      .order("id", { ascending: true })
      .returns<DemoItem[]>();

    if (error) {
      console.error("[diagnóstico] demo_items:", error.code, error.message);
      if (error.code === "PGRST205" || error.code === "42P01") {
        return { status: "error", message: ERROR_MESSAGES.missingTable };
      }
      if (error.code === "42501") {
        return { status: "error", message: ERROR_MESSAGES.permission };
      }
      return { status: "error", message: ERROR_MESSAGES.generic };
    }

    if (!data || data.length === 0) return { status: "empty" };
    return { status: "ok", items: data };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[diagnóstico] conexión con Supabase:", error);
    return { status: "error", message: ERROR_MESSAGES.generic };
  }
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

export async function DemoItemsDiagnostic() {
  const result = await loadDemoItems();

  return (
    <section
      aria-labelledby="diagnostic-title"
      className="w-full rounded-2xl border border-black/10 p-6 dark:border-white/15"
    >
      <h2 id="diagnostic-title" className="text-lg font-semibold">
        Diagnóstico de base de datos
      </h2>
      <p className="mt-1 text-sm text-foreground/60">
        Lectura de la tabla <code className="font-mono">demo_items</code> desde
        un Server Component.
      </p>

      {result.status === "ok" && (
        <>
          <p
            role="status"
            className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400"
          >
            Consulta completada: {result.items.length}{" "}
            {result.items.length === 1 ? "registro" : "registros"}.
          </p>
          <ul className="mt-3 divide-y divide-black/10 dark:divide-white/15">
            {result.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{item.name}</span>
                <time
                  dateTime={item.created_at}
                  className="text-sm text-foreground/60"
                >
                  {dateFormatter.format(new Date(item.created_at))}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}

      {result.status === "empty" && (
        <p
          role="status"
          className="mt-4 text-sm font-medium text-amber-700 dark:text-amber-400"
        >
          Consulta completada, pero la tabla no tiene registros.
        </p>
      )}

      {result.status === "error" && (
        <p
          role="alert"
          className="mt-4 text-sm font-medium text-red-700 dark:text-red-400"
        >
          Error: {result.message}
        </p>
      )}
    </section>
  );
}
