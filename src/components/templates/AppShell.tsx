import type { Hue } from "@/lib/catalog";
import { FloatingMenu } from "@/components/organisms/app/FloatingMenu";
import { NavList } from "@/components/molecules/NavList";
import { ViewerMenu } from "@/components/organisms/app/ViewerMenu";
import type { NavItem } from "@/components/organisms/app/nav";

export interface Viewer {
  name: string;
  initials: string;
  hue: Hue;
}

/**
 * Estructura: el contenido ocupa toda la pantalla y la navegación vive en un
 * botón circular flotante (FloatingMenu), igual en móvil, tableta y escritorio.
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
  children,
}: {
  nav?: NavItem[];
  current?: string;
  navigation?: React.ReactNode;
  viewer: Viewer;
  viewerActions?: React.ReactNode;
  /** Ya no se muestra; se mantiene por compatibilidad con el prototipo. */
  screenTitle?: string;
  notice?: React.ReactNode;
  children: React.ReactNode;
}) {
  const links = navigation ?? (
    <nav aria-label="Principal">
      <NavList items={nav} current={current} />
    </nav>
  );
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      {notice}
      {/* Margen inferior amplio para que el botón flotante no tape el final de la página. */}
      <main id="contenido" className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        {children}
      </main>
      <FloatingMenu>
        {links}
        <ViewerMenu name={viewer.name} initials={viewer.initials} hue={viewer.hue} actions={viewerActions} />
      </FloatingMenu>
    </div>
  );
}
