import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { Hue } from "@/lib/catalog";
import { MobileMenu } from "./MobileMenu";
import { NavList } from "./NavList";
import type { NavItem } from "./nav";

export interface Viewer {
  name: string;
  initials: string;
  hue: Hue;
}

function ProductMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex size-8 items-center justify-center rounded-[10px] bg-accent text-small font-semibold text-white"
      >
        N
      </span>
      <span className="text-body font-semibold">NacoArt3D</span>
    </span>
  );
}

function ViewerRow({ viewer }: { viewer: Viewer }) {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <Avatar initials={viewer.initials} hue={viewer.hue} size="sm" />
      <span className="min-w-0 truncate text-small">{viewer.name}</span>
    </div>
  );
}

/**
 * Estructura: barra lateral con etiquetas sobre el fondo (escritorio) y barra
 * superior de 48 px con menú a pantalla completa (móvil y tableta).
 */
export function AppShell({
  nav,
  current,
  viewer,
  screenTitle,
  notice,
  children,
}: {
  nav: NavItem[];
  current: string;
  viewer: Viewer;
  screenTitle: string;
  notice?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>

      <aside className="hidden w-60 flex-none flex-col gap-6 px-3 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <Link href={nav[0]?.href ?? "/"} className="rounded-control px-3">
          <ProductMark />
        </Link>
        <nav aria-label="Principal" className="flex-1">
          <NavList items={nav} current={current} />
        </nav>
        <ViewerRow viewer={viewer} />
      </aside>

      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-rule bg-ground px-2 lg:hidden">
        <MobileMenu title="NacoArt3D">
          <nav aria-label="Principal" className="flex-1">
            <NavList items={nav} current={current} />
          </nav>
          <ViewerRow viewer={viewer} />
        </MobileMenu>
        <span className="truncate text-body font-semibold">{screenTitle}</span>
        <span className="size-11" aria-hidden="true" />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        {notice}
        <main id="contenido" className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-16 pt-4 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
