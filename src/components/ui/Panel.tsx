/**
 * Tarjeta blanca sobre el fondo, sin sombra ni borde: la separación es el
 * escalón de tono. El título es siempre un encabezado real.
 */
export function Panel({
  title,
  titleId,
  aside,
  children,
  className = "",
  as: Tag = "section",
}: {
  title?: React.ReactNode;
  titleId?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      aria-labelledby={title && titleId ? titleId : undefined}
      className={`min-w-0 rounded-card bg-surface p-5 sm:p-6 ${className}`}
    >
      {title || aside ? (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {title ? (
            <h2 id={titleId} className="text-section font-semibold">
              {title}
            </h2>
          ) : null}
          {aside ? <div className="text-small text-muted">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
