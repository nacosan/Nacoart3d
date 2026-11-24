"use client";

import { usePathname } from "next/navigation";
import { NavList } from "@/components/molecules/NavList";
import type { NavItem } from "@/components/organisms/app/nav";

/** Navegación que marca la sección actual según la URL (la sección más específica gana). */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const current =
    items
      .map((item) => item.href)
      .filter((href): href is string => href !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)))
      .sort((a, b) => b.length - a.length)[0] ?? "";
  return (
    <nav aria-label="Principal" className="flex-1">
      <NavList items={items} current={current} />
    </nav>
  );
}
