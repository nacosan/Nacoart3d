import { acceptInvitation, declineInvitation } from "@/app/(app)/grupos/actions";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import type { ReceivedInvitation } from "@/lib/data/groups";

/** Invitaciones a grupos que ha recibido quien mira. No se muestra nada si no hay. */
export function ReceivedInvitations({ invitations }: { invitations: ReceivedInvitation[] }) {
  if (invitations.length === 0) return null;
  return (
    <section aria-labelledby="invitaciones" className="rounded-card bg-accent-soft p-6 sm:p-7">
      <h2 id="invitaciones" className="flex items-center gap-2 text-section font-semibold text-accent-ink">
        <Icon name="mail" size="lg" />
        {invitations.length === 1 ? "Tienes una invitación" : `Tienes ${invitations.length} invitaciones`}
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {invitations.map((invitation) => {
          const after = invitation.activeMembers + 1;
          const share = invitation.priceCents === null ? null : Math.floor(invitation.priceCents / after);
          return (
            <li key={invitation.id} className="flex flex-col gap-4 rounded-inner bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-body font-semibold">{invitation.subscriptionName}</p>
                <p className="text-small text-muted">
                  {invitation.leaderName} te invita a compartirla
                  {invitation.priceCents !== null ? (
                    <>
                      {" "}
                      · <Money cents={invitation.priceCents} currency={invitation.currency} />{" "}
                      {invitation.billingPeriod === "monthly" ? "al mes" : "al año"} en total
                    </>
                  ) : null}
                </p>
                {share !== null ? (
                  <p className="text-small">
                    Si aceptas, os tocaría a unos <Money cents={share} currency={invitation.currency} className="font-semibold" /> a cada
                    uno ({after} personas).
                  </p>
                ) : null}
              </div>
              <div className="flex flex-none gap-2">
                <form action={declineInvitation.bind(null, invitation.id)}>
                  <SubmitButton variant="secondary" pendingLabel="…">
                    Rechazar
                  </SubmitButton>
                </form>
                <form action={acceptInvitation.bind(null, invitation.id)}>
                  <SubmitButton icon="check" pendingLabel="Uniéndote…">
                    Aceptar
                  </SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
