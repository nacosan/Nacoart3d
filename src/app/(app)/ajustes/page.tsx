import type { Metadata } from "next";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { getProfile } from "@/lib/data/profile";
import { requireSession } from "@/lib/data/session";
import { centsToInput } from "@/lib/finance/money";
import { TIMEZONES } from "@/lib/time";

export const metadata: Metadata = { title: "Ajustes · NacoArt3D" };

export default async function SettingsPage() {
  const session = await requireSession();
  const profile = await getProfile(session);
  const timezone = TIMEZONES.some((zone) => zone.id === profile.timezone) ? profile.timezone : "Europe/Madrid";
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-title font-semibold">Ajustes</h1>
      <p className="mt-1 text-body text-muted">{session.email ? `Has entrado como ${session.email}.` : "Tu perfil y tus preferencias."}</p>
      <section aria-labelledby="perfil" className="mt-8 rounded-card bg-surface p-6 sm:p-9">
        <h2 id="perfil" className="mb-6 text-section font-semibold">
          Perfil y preferencias
        </h2>
        {!profile.stored ? (
          <p className="mb-6 rounded-inner bg-warning-soft px-4 py-3 text-small text-warning-ink">
            Podrás guardar tus ajustes cuando la base de datos esté preparada.
          </p>
        ) : null}
        <ProfileForm
          disabled={!profile.stored}
          initial={{
            displayName: profile.displayName,
            avatarHue: profile.avatarHue,
            currency: profile.currency,
            timezone,
            budget: profile.monthlyBudgetCents ? centsToInput(profile.monthlyBudgetCents) : "",
          }}
        />
      </section>
    </div>
  );
}
