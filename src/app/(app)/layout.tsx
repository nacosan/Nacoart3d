import { signOut } from "@/app/(auth)/actions";
import { AppNav } from "@/components/app/AppNav";
import { AppShell } from "@/components/app/AppShell";
import type { NavItem } from "@/components/app/nav";
import { Icon } from "@/components/ui/Icon";
import { getProfile, initialsOf } from "@/lib/data/profile";
import { requireSession } from "@/lib/data/session";

const NAV: NavItem[] = [
  { label: "Resumen", icon: "home", href: "/" },
  { label: "Suscripciones", icon: "list", href: "/suscripciones" },
  { label: "Ajustes", icon: "settings", href: "/ajustes" },
];

function SetupNotice() {
  return (
    <div className="bg-warning-soft text-warning-ink">
      <p className="mx-auto flex w-full max-w-[1120px] items-start gap-2 px-4 py-3 text-small sm:px-6 lg:px-10">
        <Icon name="info" className="mt-0.5" />
        <span>
          <strong className="font-semibold">Falta preparar la base de datos.</strong> Puedes entrar y salir, pero tus
          suscripciones no se guardarán hasta que se aplique la migración de la fase 2.
        </span>
      </p>
    </div>
  );
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const profile = await getProfile(session);
  return (
    <AppShell
      navigation={<AppNav items={NAV} />}
      viewer={{ name: profile.displayName, initials: initialsOf(profile.displayName), hue: profile.avatarHue }}
      viewerActions={
        <form action={signOut}>
          <button
            type="submit"
            title="Cerrar sesión"
            className="flex h-9 w-full items-center gap-2 rounded-full px-2 text-small text-muted hover:bg-active hover:text-ink group-data-collapsed/sidebar:justify-center"
          >
            <Icon name="logout" />
            <span className="group-data-collapsed/sidebar:sr-only">Cerrar sesión</span>
          </button>
        </form>
      }
      screenTitle="ManagSub"
      notice={profile.stored ? null : <SetupNotice />}
    >
      {children}
    </AppShell>
  );
}
