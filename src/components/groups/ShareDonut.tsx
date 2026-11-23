import { HUE_DOT, HUE_STROKE } from "@/components/ui/tones";
import { HUES, type Hue } from "@/lib/catalog";
import type { GroupMember } from "@/lib/data/groups";
import { formatMoney, type Cents, type Currency } from "@/lib/finance/money";

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Separación visible entre sectores, en unidades del círculo. */
const GAP = 3;
/** Grosor del anillo y de tu sector (algo más grueso, sin exagerar). */
const RING = 10;
const RING_MINE = 14;
/** Tamaño del gráfico en píxeles. Va en los atributos del SVG para no depender de clases CSS. */
const SIZE = 160;

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
 * Gráfico circular del reparto: un sector por persona con su color, tu parte en
 * el centro y una leyenda con nombres (no depende solo del color). Un miembro
 * solo ve su propio importe; el líder ve el de todos.
 */
export function ShareDonut({
  members,
  total,
  currency,
  period,
  showAllAmounts,
}: {
  members: GroupMember[];
  total: Cents;
  currency: Currency;
  period: "monthly" | "yearly";
  showAllAmounts: boolean;
}) {
  const colors = memberColors(members);
  const shares = memberShares(members, total);
  // Primero tú, luego el resto en el orden del grupo.
  const ordered = [...members].sort((a, b) => Number(b.isMe) - Number(a.isMe));
  const me = ordered.find((member) => member.isMe);
  const mine = me ? (shares.get(me.memberId) ?? 0) : 0;
  const several = ordered.length > 1;
  const per = period === "monthly" ? "al mes" : "al año";

  const lengths = ordered.map((member) =>
    total === 0 ? CIRCUMFERENCE / ordered.length : ((shares.get(member.memberId) ?? 0) / total) * CIRCUMFERENCE,
  );
  // Extremos redondeados para un aspecto más suave. El redondeo sobresale medio
  // grosor por cada lado, así que se descuenta del trazo para mantener el hueco.
  const arcs = ordered.map((member, index) => {
    const width = member.isMe ? RING_MINE : RING;
    const dash = several ? Math.max(0.01, lengths[index] - GAP - width) : CIRCUMFERENCE;
    const start = lengths.slice(0, index).reduce((sum, length) => sum + length, 0) + (several ? (GAP + width) / 2 : 0);
    return { member, width, dash, offset: start };
  });

  return (
    <figure className="flex flex-col items-center gap-4">
      <div className="relative flex-none">
        <svg
          viewBox="0 0 100 100"
          width={SIZE}
          height={SIZE}
          className="block"
          role="img"
          aria-label={`Reparto entre ${ordered.length} personas. Tu parte: ${formatMoney(mine, currency)} de ${formatMoney(total, currency)} ${per}.`}
        >
          {/* Pista gris solo si no hay sectores que dibujar; con varios, los huecos quedan limpios. */}
          {total === 0 ? <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth={RING} className="stroke-neutral-soft" /> : null}
          {arcs.map(({ member, width, dash, offset: start }) => (
            <circle
              key={member.memberId}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              // Tu sector, algo más grueso: se distingue también por la forma.
              strokeWidth={width}
              strokeLinecap={several ? "round" : "butt"}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-start}
              transform="rotate(-90 50 50)"
              className={HUE_STROKE[colors.get(member.memberId) ?? "azul"]}
            >
              <title>{member.isMe ? "Tú" : member.displayName}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
          <span className="text-[0.75rem] text-muted">Tu parte</span>
          <span className="text-body font-bold tabular-nums">{formatMoney(mine, currency)}</span>
        </div>
      </div>

      <figcaption className="w-full min-w-0">
        <ul className="flex flex-col divide-y divide-rule">
          {ordered.map((member) => (
            <li key={member.memberId} className="flex items-start gap-2.5 py-2 text-small first:pt-0 last:pb-0">
              <span aria-hidden="true" className={`mt-1 size-3 flex-none rounded-full ${HUE_DOT[colors.get(member.memberId) ?? "azul"]}`} />
              <span className={`min-w-0 flex-1 break-words ${member.isMe ? "font-semibold" : ""}`}>
                {member.isMe ? "Tú" : member.displayName}
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
