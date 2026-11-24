/**
 * Logotipo de ManagSub: un círculo de renovación (la suscripción que se
 * renueva) con una "M" dentro, en blanco sobre añil. Decorativo: el nombre va
 * siempre al lado en texto.
 */
export const LOGO_PATHS = {
  ring: "M22.08 9.92A8.6 8.6 0 1 1 13.77 7.69",
  arrow: "M16.67 6.92L13.18 5.47L14.37 9.91Z",
  letter: "M12.4 19.2V13.2L16 16.9L19.6 13.2V19.2",
} as const;

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="block flex-none">
      {/* fill fijo por si los estilos no han cargado; la clase lo adapta al tema. */}
      <rect width="32" height="32" rx="9" fill="#4338ca" className="fill-primary" />
      <path d={LOGO_PATHS.ring} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d={LOGO_PATHS.arrow} fill="#fff" />
      <path d={LOGO_PATHS.letter} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Logotipo con el nombre: "Manag" en tinta y "Sub" en añil. */
export function Logo({ size = 36, hideName = false }: { size?: number; hideName?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`text-body font-bold tracking-tight ${hideName ? "sr-only" : ""}`}>
        Manag<span className="text-accent-ink">Sub</span>
      </span>
    </span>
  );
}
