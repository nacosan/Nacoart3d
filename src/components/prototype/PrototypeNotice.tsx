import Link from "next/link";
import { Icon } from "@/components/atoms/Icon";

const VIEWS = [
  { href: "/prototipo", label: "Resumen de Ana" },
  { href: "/prototipo/grupos/ondas", label: "Grupo · vista de líder (Ana)" },
  { href: "/prototipo/grupos/ondas/miembro", label: "Grupo · vista de miembro (Lucía)" },
];

/** Aviso permanente: datos ficticios, fecha fija y acciones sin efecto. */
export function PrototypeNotice({ current }: { current: string }) {
  return (
    <div className="border-b border-warning-line/40 bg-warning-soft text-warning-ink">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2 px-4 py-2.5 text-small sm:px-6 lg:px-8">
        <p className="flex items-start gap-2">
          <Icon name="info" className="mt-0.5" />
          <span>
            <strong className="font-semibold">Prototipo con datos ficticios.</strong> Personas, servicios y planes son
            inventados. Fecha de referencia: 17 nov 2026. Las acciones no guardan nada.
          </span>
        </p>
        <nav aria-label="Pantallas del prototipo" className="-mx-1">
          <ul className="flex flex-wrap gap-1">
            {VIEWS.map((view) => (
              <li key={view.href}>
                <Link
                  href={view.href}
                  aria-current={view.href === current ? "page" : undefined}
                  className={`inline-flex h-8 items-center rounded-full px-3 font-medium ${
                    view.href === current ? "bg-warning-ink text-white" : "hover:bg-white/60"
                  }`}
                >
                  {view.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
