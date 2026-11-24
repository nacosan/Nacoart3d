import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/Logo";
import type { Hue } from "@/lib/catalog";
import { MobileMenu } from "./MobileMenu";
import { NavList } from "./NavList";
import { Sidebar } from "./Sidebar";
import { ViewerMenu } from "./ViewerMenu";
import type { NavItem } from "./nav";

export interface Viewer {
  name: string;
  initials: string;
  hue: Hue;
}

function ProductMark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={36} />
      <span className="text-body font-bold tracking-tight group-data-collapsed/sidebar:sr-only">
        Manag<span className="text-accent-ink">Sub</span>
      </span>
    </span>
  );
}

/**
 * Estructura: barra lateral con etiquetas sobre el fondo (escritorio) y barra
 * superior con menú a pantalla completa (móvil y tableta).
 *
 * `navigation` sustituye a la lista estática (la app real la marca según la URL).
 */
export function AppShell({
  nav = [],
  current = "",
  navigation,
  viewer,
  viewerActions,
  notice,
  sidebarCollapsed = false,
  children,
}: {
  nav?: NavItem[];
  current?: string;
  navigation?: React.ReactNode;
  viewer: Viewer;
  viewerActions?: React.ReactNode;
  /** Ya no se muestra (la barra superior lleva el logotipo); se mantiene por compatibilidad. */
  screenTitle?: string;
  notice?: React.ReactNode;
  /** Estado inicial de la barra lateral (cookie leída en el servidor). */
  sidebarCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const links = navigation ?? (
    <nav aria-label="Principal" className="flex-1">
      <NavList items={nav} current={current} />
    </nav>
  );
  const home = nav[0]?.href ?? "/";
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>

      <Sidebar
        initialCollapsed={sidebarCollapsed}
        brand={
          <Link href={home} className="rounded-control px-2 group-data-collapsed/sidebar:px-0">
            <ProductMark />
          </Link>
        }
      >
        {links}
        <ViewerMenu name={viewer.name} initials={viewer.initials} hue={viewer.hue} actions={viewerActions} />
      </Sidebar>

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between bg-ground/95 px-2 backdrop-blur lg:hidden">
        <MobileMenu title="ManagSub">
          {links}
          <ViewerMenu name={viewer.name} initials={viewer.initials} hue={viewer.hue} actions={viewerActions} />
        </MobileMenu>
        <Link href={home} className="rounded-control" aria-label="ManagSub, ir al inicio">
          <Logo size={30} />
        </Link>
        <span className="size-11" aria-hidden="true" />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        {notice}
        <main id="contenido" className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-20 pt-4 sm:px-6 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
