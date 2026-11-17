import Link from "next/link";

/**
 * Control segmentado hecho de enlaces: cada vista tiene su URL y funciona sin
 * JavaScript. La opción activa se marca con aria-current, fondo blanco y peso.
 * En pantallas estrechas ocupa todo el ancho en columnas iguales y las
 * etiquetas largas pasan a dos líneas en vez de cortarse.
 */
export function SegmentedLinks({
  label,
  options,
}: {
  label: string;
  options: { href: string; label: string; current: boolean }[];
}) {
  const columns = options.length === 2 ? "grid-cols-2" : options.length === 3 ? "grid-cols-3" : "grid-cols-4";
  return (
    <nav aria-label={label} className="w-full sm:w-auto">
      <ul className={`grid ${columns} gap-1 rounded-[12px] bg-active p-1 sm:inline-flex`}>
        {options.map((option) => (
          <li key={option.href} className="min-w-0">
            <Link
              href={option.href}
              scroll={false}
              aria-current={option.current ? "page" : undefined}
              className={`flex min-h-9 items-center justify-center rounded-[9px] px-2 py-1 text-center text-small leading-tight transition-colors duration-150 sm:whitespace-nowrap sm:px-3.5 ${
                option.current ? "bg-surface font-semibold text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
