/**
 * Iconos de contorno propios (24×24, trazo 1,5). Decorativos por defecto:
 * el texto que los acompaña da el significado.
 */
const PATHS = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  list: "M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01",
  users:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2A6.5 6.5 0 0 1 21.5 20",
  wallet:
    "M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h14V8H6.5A2.5 2.5 0 0 1 4 7.5zM16.5 13.5h.01",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.07-.4.1-.8.1-1.2z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2",
  alert: "M12 3.5 2.8 19.5h18.4zM12 10v4M12 17h.01",
  hourglass: "M7 3.5h10M7 20.5h10M8 3.5v3.2a4 4 0 0 0 1.6 3.2L12 12l2.4-2.1A4 4 0 0 0 16 6.7V3.5M8 20.5v-3.2a4 4 0 0 1 1.6-3.2L12 12l2.4 2.1a4 4 0 0 1 1.6 3.2v3.2",
  calendar: "M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5V7M15.5 3.5V7",
  half: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18",
  coins: "M9 8.5c3.3 0 6-1.1 6-2.5S12.3 3.5 9 3.5 3 4.6 3 6s2.7 2.5 6 2.5zM3 6v5c0 1.4 2.7 2.5 6 2.5M15 10.5c3.3 0 6 1.1 6 2.5s-2.7 2.5-6 2.5-6-1.1-6-2.5M9 13v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "M9.5 6l6 6-6 6",
  chevronDown: "M6 9.5l6 6 6-6",
  chevronUp: "M6 14.5l6-6 6 6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5h.01",
  plus: "M12 5v14M5 12h14",
  userOff: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20a7 7 0 0 1 11.2-5.6M17 17l4 4M21 17l-4 4",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  send: "M4 12 20 4l-4 16-4-7zM12 13l8-9",
  logout: "M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  trash: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10 11v5M14 11v5",
  back: "M14.5 6l-6 6 6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  sidebar: "M4 5h16v14H4zM9.5 5v14",
  chart: "M4 20h16M7 16v-4M12 16V8M17 16v-7",
} as const;

export type IconName = keyof typeof PATHS;

const SIZE = { sm: "size-3.5", md: "size-4", lg: "size-5" } as const;

export function Icon({
  name,
  size = "md",
  className = "",
  label,
}: {
  name: IconName;
  size?: keyof typeof SIZE;
  /** Clases extra (márgenes, color). El tamaño va siempre en `size`. */
  className?: string;
  /** Si el icono va solo, su nombre accesible. */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${SIZE[size]} ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
