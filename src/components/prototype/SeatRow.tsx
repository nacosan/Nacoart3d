import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { Hue } from "@/lib/catalog";
import { formatDay, type ISODate } from "@/lib/finance/dates";

export interface SeatPerson {
  initials: string;
  name: string;
  hue: Hue;
  isLeader: boolean;
  hasAccount: boolean;
  isYou?: boolean;
}

/**
 * Las plazas del plan como asientos: ocupada (inicial de la persona),
 * reservada (contorno discontinuo con caducidad) y libre (contorno vacío).
 */
export function SeatRow({
  people,
  reserved,
  reservedUntil,
  free,
  max,
}: {
  people: SeatPerson[];
  reserved: number;
  reservedUntil: ISODate | null;
  free: number;
  max: number;
}) {
  return (
    <div className="@container">
      {/* Columnas según el ancho de la tarjeta (container query), no de la pantalla. */}
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4 @xl:grid-cols-8" aria-label={`${max} plazas`}>
        {people.map((person) => (
          <li key={person.initials + person.name} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <Avatar initials={person.initials} hue={person.hue} size="lg" guest={!person.hasAccount} />
            <span className="w-full truncate text-small">
              {person.isYou ? "Tú" : person.name.split(" ")[0]}
            </span>
            <span className="sr-only">
              {person.isLeader ? "líder" : "miembro"}
              {person.hasAccount ? "" : ", sin cuenta"}
            </span>
            {person.isLeader ? (
              <span className="-mt-1 text-[0.75rem] text-muted" aria-hidden="true">
                Líder
              </span>
            ) : !person.hasAccount ? (
              <span className="-mt-1 text-[0.75rem] text-muted" aria-hidden="true">
                Sin cuenta
              </span>
            ) : null}
          </li>
        ))}
        {Array.from({ length: reserved }, (_, index) => (
          <li key={`reserved-${index}`} className="flex flex-col items-center gap-1.5 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-full border-2 border-dashed border-accent text-accent-ink">
              <Icon name="clock" />
            </span>
            <span className="text-small">Reservada</span>
            {reservedUntil ? (
              <span className="-mt-1 text-[0.75rem] text-muted">hasta {formatDay(reservedUntil)}</span>
            ) : null}
          </li>
        ))}
        {Array.from({ length: free }, (_, index) => (
          <li key={`free-${index}`} className="flex flex-col items-center gap-1.5 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-full border-2 border-control text-muted">
              <Icon name="plus" />
            </span>
            <span className="text-small text-muted">Libre</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-small text-muted">
        <span className="font-semibold text-ink tabular-nums">{people.length}</span>{" "}
        {people.length === 1 ? "ocupada" : "ocupadas"} ·{" "}
        <span className="font-semibold text-ink tabular-nums">{reserved}</span>{" "}
        {reserved === 1 ? "reservada" : "reservadas"} ·{" "}
        <span className="font-semibold text-ink tabular-nums">{free}</span> {free === 1 ? "libre" : "libres"} · máximo{" "}
        <span className="tabular-nums">{max}</span>, titular incluido (dato de plan ficticio).
      </p>
    </div>
  );
}
