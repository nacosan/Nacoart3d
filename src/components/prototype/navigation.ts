import type { NavItem } from "@/components/app/nav";
import { ondas } from "@/prototype/model";

const awaiting = ondas.members.filter((member) => member.declaredPending > 0).length;

/** Navegación de Ana (líder de Ondas Familiar, miembro de Pixa). */
export const leaderNav: NavItem[] = [
  { label: "Resumen", icon: "home", href: "/prototipo" },
  { label: "Suscripciones", icon: "list", href: null },
  { label: "Grupos", icon: "users", href: "/prototipo/grupos/ondas" },
  { label: "Pagos", icon: "wallet", href: null, count: { value: awaiting, noun: awaiting === 1 ? "pago por confirmar" : "pagos por confirmar" } },
  { label: "Invitaciones", icon: "mail", href: null },
  { label: "Ajustes", icon: "settings", href: null },
];

/** Navegación de Lucía (miembro de Ondas Familiar). */
export const memberNav: NavItem[] = [
  { label: "Resumen", icon: "home", href: null },
  { label: "Suscripciones", icon: "list", href: null },
  { label: "Grupos", icon: "users", href: "/prototipo/grupos/ondas/miembro" },
  { label: "Pagos", icon: "wallet", href: null },
  { label: "Invitaciones", icon: "mail", href: null },
  { label: "Ajustes", icon: "settings", href: null },
];
