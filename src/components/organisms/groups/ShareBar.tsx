import { Icon } from "@/components/atoms/Icon";
import { HUE_DOT, HUE_FILL } from "@/components/atoms/tones";
import { HUES, type Hue } from "@/lib/catalog";
import type { GroupMember } from "@/lib/data/groups";
import { formatMoney, type Cents, type Currency } from "@/lib/finance/money";

/**
 * Un color distinto por persona. Se respeta el color de su perfil salvo que ya
 * lo tenga otra persona del grupo; entonces se le da el primero libre.
 */
export function memberColors(members: GroupMember[]): Map<string, Hue> {
  const used = new Set<Hue>();
  const colors = new Map<string, Hue>();
  for (const member of members) {
    const hue = used.has(member.avatarHue) ? (HUES.find((candidate) => !used.has(candidate)) ?? member.avatarHue) : member.avatarHue;
    used.add(hue);
    colors.set(member.memberId, hue);
  }
  return colors;
}

/** Parte de cada persona: a partes iguales y el líder asume los céntimos sobrantes. */
export function memberShares(members: GroupMember[], total: Cents): Map<string, Cents> {
  const count = Math.max(1, members.length);
  const base = Math.floor(total / count);
  const leaderShare = total - base * (count - 1);
  return new Map(members.map((member) => [member.memberId, member.role === "leader" ? leaderShare : base]));
}

/**
 * Barra del reparto: un tramo por persona con su color, proporcional a lo que
 * paga. Tu tramo es algo más alto, para distinguirlo también por la forma.
 * Debajo, la lista con nombres (no depende solo del color); un miembro solo ve
 * su propio importe y el líder, el de todos.
 */
export function ShareBar({
  members,
  total,
  currency,
  period,
  showAllAmounts,
  hideMine = false,
  shares: sharesOverride,
}: {
  members: GroupMember[];
  total: Cents;
  currency: Currency;
  period: "monthly" | "yearly";
  showAllAmounts: boolean;
  /** No repetir "Tu parte" encima (cuando ya es la cifra principal de la tarjeta). */
  hideMine?: boolean;
  /** Importes fijos por persona, en vez del reparto a partes iguales. */
  shares?: Map<string, Cents>;
}) {
  const colors = memberColors(members);
  const shares = sharesOverride ?? memberShares(members, total);
  // Primero tú, luego el resto en el orden del grupo.
  const ordered = [...members].sort((a, b) => Number(b.isMe) - Number(a.isMe));
  const me = ordered.find((member) => member.isMe);
  const mine = me ? (shares.get(me.memberId) ?? 0) : 0;
  const per = period === "monthly" ? "al mes" : "al año";
  // Huecos de 1,5 % entre tramos; el resto se reparte en proporción.
  const gap = ordered.length > 1 ? 1.5 : 0;
  const usable = 100 - gap * (ordered.length - 1);
  const widths = ordered.map((member) =>
    total === 0 ? usable / ordered.length : ((shares.get(member.memberId) ?? 0) / total) * usable,
  );

  return (
    <figure className="flex flex-col gap-3">
      {hideMine ? null : (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-small text-muted">Tu parte</span>
          <span className="text-section font-bold tabular-nums">{formatMoney(mine, currency)}</span>
          <span className="text-small text-muted">{per}</span>
        </p>
      )}
      <svg
        width="100%"
        height="16"
        className="block overflow-visible"
        role="img"
        aria-label={`Reparto entre ${ordered.length} personas. Tu parte: ${formatMoney(mine, currency)} de ${formatMoney(total, currency)} ${per}.`}
      >
        {ordered.map((member, index) => {
          const x = widths.slice(0, index).reduce((sum, width) => sum + width, 0) + gap * index;
          const height = member.isMe ? 16 : 10;
          return (
            <rect
              key={member.memberId}
              x={`${x}%`}
              y={member.isMe ? 0 : 3}
              width={`${Math.max(widths[index], 0.5)}%`}
              height={height}
              rx={height / 2}
              className={HUE_FILL[colors.get(member.memberId) ?? "azul"]}
            >
              <title>{member.isMe ? "Tú" : member.displayName}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="w-full min-w-0">
        <ul className="flex flex-col divide-y divide-rule">
          {ordered.map((member) => (
            <li key={member.memberId} className="flex items-start gap-2.5 py-2 text-small first:pt-0 last:pb-0">
              <span aria-hidden="true" className={`mt-1 size-3 flex-none rounded-full ${HUE_DOT[colors.get(member.memberId) ?? "azul"]}`} />
              <span className={`min-w-0 flex-1 break-words ${member.isMe ? "font-semibold" : ""}`}>
                {member.isMe ? "Tú" : member.displayName}
                {member.role === "leader" ? (
                  <Icon name="crown" size="sm" className="ml-1.5 inline-block align-[-2px] text-warning-ink" label="Propietario: paga el plan" />
                ) : null}
                {member.isGuest ? <span className="font-normal text-muted"> · sin cuenta</span> : null}
              </span>
              {showAllAmounts || member.isMe ? (
                <span className="whitespace-nowrap font-semibold tabular-nums">{formatMoney(shares.get(member.memberId) ?? 0, currency)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
