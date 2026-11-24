/** Estado que devuelven las Server Actions de formulario a useActionState. */
export interface FormState {
  /** Mensaje general (error o confirmación). */
  message?: string;
  tone?: "error" | "success";
  /** Errores por campo, con el nombre del input. */
  fieldErrors?: Record<string, string>;
  /** Valores enviados, para no vaciar el formulario si hay errores. */
  values?: Record<string, string>;
}

export const EMPTY_FORM_STATE: FormState = {};
