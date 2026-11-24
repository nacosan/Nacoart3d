import type { IconName } from "@/components/atoms/Icon";

export interface NavItem {
  label: string;
  icon: IconName;
  /** null: pantalla no incluida en el prototipo. */
  href: string | null;
  /** Solo en colas que requieren acción, con su nombre claro. */
  count?: { value: number; noun: string };
}
