"use client";

import { useState } from "react";

/**
 * En una suscripción compartida, quien paga el plan elige con un interruptor
 * qué quiere anotar: el pago del servicio o el pago que le ha hecho una persona.
 */
export function PaymentKindSwitch({
  service,
  person,
  initial = "service",
}: {
  service: React.ReactNode;
  person: React.ReactNode;
  initial?: "service" | "person";
}) {
  const [kind, setKind] = useState<"service" | "person">(initial);
  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="sr-only">¿Qué pago quieres anotar?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-active p-1">
          {(
            [
              { value: "service", label: "Pago del servicio" },
              { value: "person", label: "Pago de una persona" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 cursor-pointer items-center justify-center rounded-full px-3 text-center text-small leading-tight text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="paymentKind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "service" ? service : person}
    </div>
  );
}
