import { leaveGroup, removeMember, revokeInvitation } from "@/app/(app)/grupos/actions";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Avatar } from "@/components/ui/Avatar";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { initialsOf } from "@/lib/data/profile";
import type { GroupMember, PendingInvite } from "@/lib/data/groups";
import { formatDay } from "@/lib/finance/dates";
import type { PersonalSubscription } from "@/lib/subscriptions/personal";
import { AddPeople } from "./AddPeople";
import { memberColors } from "./ShareDonut";

/** Plazas del plan: ocupadas, reservadas por invitación y libres. */
function Seats({ members, invites, max }: { members: GroupMember[]; invites: PendingInvite[]; max: number | null }) {
  const colors = memberColors(members);
  const free = max === null ? 0 : Math.max(0, max - members.length - invites.length);
  return (
    <div>
      <ul className="flex flex-wrap gap-2" aria-label="Plazas del plan">
        {members.map((member) => (
          <li key={member.memberId} title={member.displayName}>
            <Avatar initials={initialsOf(member.displayName)} hue={colors.get(member.memberId) ?? member.avatarHue} guest={member.isGuest} />
            <span className="sr-only">{member.displayName}, ocupa plaza</span>
          </li>
        ))}
        {invites.map((invite) => (
          <li key={invite.id} className="size-9 rounded-full border-2 border-dashed border-control" title={`Reservada: ${invite.email}`}>
            <span className="sr-only">Plaza reservada para {invite.email}</span>
          </li>
        ))}
        {Array.from({ length: free }, (_, index) => (
          <li key={`libre-${index}`} className="size-9 rounded-full border border-border bg-raised">
            <span className="sr-only">Plaza libre</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-small text-muted">
        {members.length} {members.length === 1 ? "ocupada" : "ocupadas"}
        {invites.length ? ` · ${invites.length} ${invites.length === 1 ? "reservada" : "reservadas"}` : ""}
        {max !== null ? ` · ${free} ${free === 1 ? "libre" : "libres"} de ${max}` : ""}
      </p>
    </div>
  );
}

export function PeoplePanel({
  sub,
  members,
  invites,
  bare = false,
}: {
  sub: PersonalSubscription;
  members: GroupMember[];
  invites: PendingInvite[];
  bare?: boolean;
}) {
  const leader = sub.role === "leader";
  const colors = memberColors(members);
  const full = sub.maxMembers !== null && members.length + invites.length >= sub.maxMembers;

  return (
    <Panel title="Personas" titleId="personas" bare={bare}>
      <Seats members={members} invites={invites} max={sub.maxMembers} />

      <ul className="mt-5 flex flex-col">
        {members.map((member) => {
          return (
            <li key={member.memberId} className="flex flex-wrap items-center gap-3 border-b border-rule py-3 last:border-b-0">
              <Avatar initials={initialsOf(member.displayName)} hue={colors.get(member.memberId) ?? member.avatarHue} size="sm" guest={member.isGuest} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-semibold">
                  {member.displayName}
                  {member.isMe ? <span className="font-normal text-muted"> (tú)</span> : null}
                </p>
                <p className="text-[0.8125rem] text-muted">
                  {member.role === "leader" ? "Paga el plan" : member.isGuest ? "Sin cuenta" : "Con cuenta"}
                </p>
              </div>
              {leader && member.role === "member" ? (
                <details>
                  <summary className="cursor-pointer list-none rounded-full px-2 py-1 text-[0.8125rem] font-medium text-muted hover:bg-active hover:text-ink [&::-webkit-details-marker]:hidden">
                    Quitar
                  </summary>
                  <form action={removeMember.bind(null, sub.id, member.memberId)} className="mt-2 flex flex-col items-end gap-2">
                    <p className="max-w-56 text-right text-[0.8125rem] text-muted">Dejará de contar en el reparto desde hoy.</p>
                    <SubmitButton variant="danger" pendingLabel="Quitando…">
                      Sí, quitar
                    </SubmitButton>
                  </form>
                </details>
              ) : null}
            </li>
          );
        })}
        {leader
          ? invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center gap-3 border-b border-rule py-3 last:border-b-0">
                <span aria-hidden="true" className="size-7 flex-none rounded-full border-2 border-dashed border-control" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold">{invite.email}</p>
                  <p className="text-[0.8125rem] text-muted">Caduca el {formatDay(invite.expiresAt.slice(0, 10), true)}</p>
                </div>
                <Pill tone="accent" icon="hourglass">
                  Pendiente
                </Pill>
                <form action={revokeInvitation.bind(null, sub.id, invite.id)}>
                  <button type="submit" className="rounded-full px-2 py-1 text-[0.8125rem] font-medium text-muted hover:bg-active hover:text-ink">
                    Anular
                  </button>
                </form>
              </li>
            ))
          : null}
      </ul>

      <p className="mt-3 text-[0.8125rem] text-muted">
        Las invitaciones pendientes reservan plaza, pero no cuentan en el reparto hasta que se aceptan.
      </p>

      {leader ? (
        full ? (
          <p className="mt-6 text-small text-muted">El plan está completo. Quita a alguien o anula una invitación para hacer sitio.</p>
        ) : (
          <div className="mt-6 border-t border-rule pt-5">
            <p className="mb-3 text-small font-semibold">Añadir a alguien</p>
            <AddPeople subscriptionId={sub.id} />
          </div>
        )
      ) : (
        <details className="mt-6 rounded-inner border border-border">
          <summary className="cursor-pointer rounded-inner px-4 py-3 text-small font-semibold text-muted">Salir del grupo</summary>
          <form action={leaveGroup.bind(null, sub.id)} className="flex flex-col items-start gap-3 px-4 pb-4">
            <p className="text-small text-muted">Dejarás de ver esta suscripción y de contar en el reparto.</p>
            <SubmitButton variant="danger" pendingLabel="Saliendo…">
              Sí, salir
            </SubmitButton>
          </form>
        </details>
      )}
    </Panel>
  );
}
