import { Icon } from "@/components/ui/Icon";
import type { FormState } from "./FormState";

/** Mensaje general del formulario, anunciado por los lectores de pantalla. */
export function FormMessage({ state }: { state: FormState }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {state.message ? (
        <p
          className={`flex items-start gap-2 rounded-inner px-4 py-3 text-small ${
            state.tone === "success" ? "bg-positive-soft text-positive-ink" : "bg-negative-soft text-negative-ink"
          }`}
        >
          <Icon name={state.tone === "success" ? "check" : "alert"} className="mt-0.5" />
          <span>{state.message}</span>
        </p>
      ) : null}
    </div>
  );
}
