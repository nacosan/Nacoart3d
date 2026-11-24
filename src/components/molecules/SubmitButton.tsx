"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";

/** Botón de envío que se desactiva mientras se envía (evita dobles envíos). */
export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  variant = "primary",
  icon,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  icon?: IconName;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} icon={icon} disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
