const CONTROL =
  "w-full rounded-control border border-border bg-surface px-4 py-2.5 text-body text-ink placeholder:text-muted/70 hover:border-control focus-visible:border-accent aria-invalid:border-negative";

/** Campo con etiqueta, ayuda y error enlazados con aria-describedby. */
export function Field({
  label,
  name,
  error,
  hint,
  children,
  optional = false,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: React.ReactNode;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true; className: string }) => React.ReactNode;
  optional?: boolean;
}) {
  const id = `campo-${name}`;
  const described = [hint ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-semibold">
        {label}
        {optional ? <span className="font-normal text-muted"> (opcional)</span> : null}
      </label>
      {children({ id, "aria-describedby": described, "aria-invalid": error ? true : undefined, className: CONTROL })}
      {hint ? (
        <p id={`${id}-ayuda`} className="text-small text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-small font-medium text-negative-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Opciones en forma de tarjetas (radio) para elecciones cortas. */
export function ChoiceGroup({
  legend,
  name,
  options,
  defaultValue,
  error,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string; hint?: string }[];
  defaultValue?: string;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? `campo-${name}-error` : undefined}>
      <legend className="mb-1.5 text-small font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer flex-col rounded-control border border-border bg-surface px-4 py-3 hover:border-control has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <span className="flex items-center gap-2 text-small font-semibold">
              <input
                type="radio"
                name={name}
                value={option.value}
                defaultChecked={defaultValue === option.value}
                required
                className="size-4 accent-primary focus-visible:outline-none"
              />
              {option.label}
            </span>
            {option.hint ? <span className="mt-0.5 pl-6 text-small text-muted">{option.hint}</span> : null}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`campo-${name}-error`} className="text-small font-medium text-negative-ink">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
