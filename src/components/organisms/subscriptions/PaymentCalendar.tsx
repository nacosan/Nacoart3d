"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { sendPaymentReminder, voidMemberPayment } from "@/app/(app)/grupos/actions";
import { voidPayment } from "@/app/(app)/suscripciones/actions";
import { Avatar } from "@/components/atoms/Avatar";
import { Icon, type IconName } from "@/components/atoms/Icon";
import type { Hue } from "@/lib/catalog";
import { formatDay } from "@/lib/finance/dates";
import { formatMoney, type Currency } from "@/lib/finance/money";
import type { CalendarSegment, InstallmentStatus } from "@/lib/subscriptions/collections";

export interface CalendarRow {
  key: string;
  name: string;
  initials: string;
  hue: Hue;
  isGuest: boolean;
  /** Qué ventana abre "Añadir pago" para esta fila (null: no se puede desde aquí). */
  payAction: "pago" | "cobros" | null;
  /** Cómo se anula un pago de esta fila: tuyo (ledger) o de un miembro (solo quien paga el plan). */
  voidKind: "ledger" | "member" | null;
  segments: CalendarSegment[];
}

/** Un mes del rango mostrado (puede cruzar de año). */
export interface CalendarMonth {
  year: number;
  month: number;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Cada estado lleva icono y texto (en la ventana y la leyenda), no solo color. */
const STATUS: Record<InstallmentStatus, { label: string; icon: IconName; className: string }> = {
  paid: { label: "Pagado", icon: "check", className: "bg-positive-soft text-positive-ink" },
  partial: { label: "Pagado en parte", icon: "half", className: "hatch bg-warning-soft text-warning-ink" },
  awaiting: { label: "Por confirmar", icon: "hourglass", className: "border-2 border-dashed border-accent bg-accent-soft text-accent-ink" },
  pending: { label: "Pendiente", icon: "clock", className: "border border-control bg-surface text-neutral-ink" },
  overdue: { label: "Vencido", icon: "alert", className: "border-2 border-negative bg-negative-soft text-negative-ink" },
  upcoming: { label: "Próximo", icon: "calendar", className: "border border-dashed border-control text-muted" },
};

function groupLabel(segment: CalendarSegment) {
  if (!segment.grouped) return null;
  return segment.periods === 12 ? "Pagado el año" : `Pagado ${segment.periods} meses`;
}

/** Qué día fue (el pago o la renovación) y hasta cuándo cubre. */
function details(segment: CalendarSegment, currency: Currency): { title: string; first: string; second: string } {
  const amount = formatMoney(segment.status === "awaiting" ? segment.declared : segment.due, currency);
  const until = `Hasta el ${formatDay(segment.through, true)}`;
  switch (segment.status) {
    case "paid":
      return {
        title: groupLabel(segment) ?? "Pagado",
        first: segment.paidOn ? `Pagado el ${formatDay(segment.paidOn, true)} · ${formatMoney(segment.confirmed, currency)}` : "Pagado",
        second: `Cubre hasta el ${formatDay(segment.through, true)}`,
      };
    case "partial":
      return {
        title: "Pagado en parte",
        first: `${formatMoney(segment.confirmed, currency)} de ${formatMoney(segment.due, currency)}${segment.paidOn ? ` · el ${formatDay(segment.paidOn, true)}` : ""}`,
        second: until,
      };
    case "awaiting":
      return {
        title: "Por confirmar",
        first: `Declarado${segment.paidOn ? ` el ${formatDay(segment.paidOn, true)}` : ""} · ${amount}`,
        second: `Cubriría hasta el ${formatDay(segment.through, true)}`,
      };
    case "overdue":
      return { title: "Vencido", first: `Renovó el ${formatDay(segment.from, true)} · ${amount}`, second: until };
    case "pending":
      return { title: "Pendiente", first: `Renovó el ${formatDay(segment.from, true)} · ${amount}`, second: until };
    default:
      return { title: "Próximo", first: `Renueva el ${formatDay(segment.from, true)} · ${amount}`, second: until };
  }
}

/**
 * Calendario de pagos: una fila por persona y un mes por columna. Un pago que
 * cubre varios meses se dibuja como un único tramo. Al abrir se coloca para
 * que se vean el mes actual y, como mucho, los dos siguientes (si pasan de
 * diciembre, se añaden los meses del año siguiente). Tocar un mes abre una ventana con el detalle y,
 * si falta por pagar, "Añadir pago".
 */
export function PaymentCalendar({
  rows,
  months,
  year,
  currentYear,
  focusCol,
  basePath,
  currency,
  subscriptionId,
  subscriptionTitle,
  reminders = false,
}: {
  rows: CalendarRow[];
  months: CalendarMonth[];
  /** Año elegido en el selector (?anio=). */
  year: number;
  currentYear: number;
  /** Columna del mes actual (1 = primer mes); null fuera del año actual (empieza por enero). */
  focusCol: number | null;
  basePath: string;
  currency: Currency;
  subscriptionId: string;
  subscriptionTitle: string;
  /** Quien paga el plan puede recordar los pagos pendientes a los demás. */
  reminders?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  // Año que muestra el selector: el elegido o el del último mes tocado.
  const [shownYear, setShownYear] = useState(year);
  const [legendOpen, setLegendOpen] = useState(false);

  // Coloca la vista para que el último mes visible sea, como mucho, el segundo después del actual.
  const scrollToFocus = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (focusCol === null) {
      container.scrollLeft = 0;
      return;
    }
    const last = container.querySelector<HTMLElement>(`[data-col="${Math.min(focusCol + 2, months.length)}"]`);
    if (last) container.scrollLeft = Math.max(0, last.offsetLeft + last.offsetWidth + 4 - container.clientWidth);
  }, [focusCol, months.length]);

  useEffect(() => {
    scrollToFocus();
  }, [scrollToFocus, year]);

  function select(row: CalendarRow, segment: CalendarSegment, anchor: HTMLElement) {
    // Tocar el mismo mes otra vez cierra el bocadillo.
    if (selected && selected.row.key === row.key && selected.segment.startCol === segment.startCol) {
      setSelected(null);
      return;
    }
    const at = months[segment.startCol - 1];
    setSelected({ row, segment, at, anchor });
    setShownYear(at.year);
  }

  /*
   * Coloca el bocadillo encima del mes tocado (o debajo, si no cabe arriba).
   * Las coordenadas dependen de dónde está el mes en pantalla, así que se
   * asignan desde aquí: es la única excepción a "sin estilos en línea".
   */
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!selected || !bubble) return;
    const rect = selected.anchor.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(center - width / 2, 8), window.innerWidth - width - 8);
    const above = rect.top - height - 12 >= 8;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${above ? rect.top - height - 12 : rect.bottom + 12}px`;
    bubble.style.setProperty("--tail-x", `${center - left}px`);
    bubble.dataset.side = above ? "top" : "bottom";
  }, [selected]);

  // Se cierra al tocar fuera, con Escape, al desplazar o al cambiar el tamaño.
  useEffect(() => {
    if (!selected) return;
    const close = () => setSelected(null);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (bubbleRef.current?.contains(target) || target.closest("[data-cal-cell]")) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const scroller = scrollRef.current;
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    scroller?.addEventListener("scroll", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      scroller?.removeEventListener("scroll", close);
    };
  }, [selected]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`${basePath}?anio=${shownYear - 1}`}
          scroll={false}
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-active"
        >
          <Icon name="back" label={`Año ${shownYear - 1}`} />
        </Link>
        <span className="text-body font-semibold tabular-nums">{shownYear}</span>
        <span className="flex items-center gap-1">
          <Link
            href={`${basePath}?anio=${shownYear + 1}`}
            scroll={false}
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-active"
          >
            <Icon name="chevron" label={`Año ${shownYear + 1}`} />
          </Link>
          {year !== currentYear ? (
            <Link
              href={`${basePath}?anio=${currentYear}`}
              scroll={false}
              className="inline-flex size-10 items-center justify-center rounded-full text-accent-ink hover:bg-active"
            >
              <Icon name="undo" label={`Volver a ${currentYear}`} />
            </Link>
          ) : null}
        </span>
      </div>

      {/* Tabla HTML: los meses que cubre un mismo pago se unen con colSpan (sin depender de clases CSS). */}
      <div ref={scrollRef} className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-separate border-spacing-1">
          <caption className="sr-only">Pagos de cada persona por mes</caption>
          <colgroup>
            <col />
            {months.map((month) => (
              <col key={`${month.year}-${month.month}`} width={`${Math.floor(90 / Math.max(12, months.length))}%`} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" data-col="0" className="sticky left-0 z-[1] bg-surface text-left">
                <span className="sr-only">Persona</span>
              </th>
              {months.map((month, index) => {
                const otherYear = month.year !== year;
                const now = focusCol !== null && index + 1 === focusCol;
                return (
                  <th
                    key={`${month.year}-${month.month}`}
                    scope="col"
                    data-col={index + 1}
                    title={`${MONTHS_LONG[month.month - 1]} de ${month.year}`}
                    className={`pb-1 text-center text-[0.75rem] ${
                      now ? "font-bold text-ink" : otherYear ? "font-semibold text-accent-ink" : "font-normal text-muted"
                    }`}
                  >
                    {MONTHS[month.month - 1]}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cells: React.ReactNode[] = [];
              for (let col = 1; col <= months.length; ) {
                const segment = row.segments.find((item) => item.startCol === col);
                if (!segment) {
                  cells.push(
                    <td key={col} className="p-0">
                      <span className="block h-9 rounded-[8px] bg-raised" />
                    </td>,
                  );
                  col += 1;
                  continue;
                }
                const style = STATUS[segment.status];
                const label = groupLabel(segment);
                const cell = details(segment, currency);
                const at = months[col - 1];
                cells.push(
                  <td key={col} colSpan={segment.span} className="p-0">
                    <button
                      type="button"
                      data-cal-cell=""
                      onClick={(event) => select(row, segment, event.currentTarget)}
                      aria-expanded={selected?.row.key === row.key && selected.segment.startCol === segment.startCol}
                      title={`${cell.title}. ${cell.first}. ${cell.second}.`}
                      aria-label={`${row.name}, ${MONTHS_LONG[at.month - 1]} de ${at.year}: ${cell.title}`}
                      className={`flex h-9 w-full items-center justify-center gap-1.5 overflow-hidden rounded-[8px] px-1.5 text-[0.75rem] font-semibold ${style.className}`}
                    >
                      <Icon name={style.icon} size="sm" />
                      {label ? <span className="truncate">{label}</span> : null}
                    </button>
                  </td>,
                );
                col += segment.span;
              }
              return (
                <tr key={row.key}>
                  <th scope="row" className="sticky left-0 z-[1] whitespace-nowrap bg-surface pr-2 text-left font-normal">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar initials={row.initials} hue={row.hue} size="sm" guest={row.isGuest} />
                      <span className="max-w-32 truncate text-small font-semibold" title={row.name}>
                        {row.name}
                      </span>
                    </span>
                  </th>
                  {cells}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8125rem] text-muted">Toca un mes para ver el detalle o añadir un pago.</p>
        <button
          type="button"
          onClick={() => setLegendOpen(!legendOpen)}
          aria-expanded={legendOpen}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[0.8125rem] font-semibold text-muted hover:bg-active hover:text-ink"
        >
          {legendOpen ? "Ocultar leyenda" : "Ver leyenda"}
          <Icon name={legendOpen ? "chevronUp" : "chevronDown"} size="sm" />
        </button>
      </div>
      {selected ? (
        <Bubble
          bubbleRef={bubbleRef}
          selected={selected}
          currency={currency}
          payHref={
            selected.row.payAction && selected.segment.status !== "paid"
              ? `${basePath}?anio=${year}&renovacion=${selected.segment.from}&miembro=${selected.row.key}&abrir=${selected.row.payAction}`
              : null
          }
          extra={
            <>
              {reminders && selected.row.payAction === "cobros" && ["pending", "overdue", "partial"].includes(selected.segment.status) ? (
                <ReminderAction
                  subscriptionId={subscriptionId}
                  subscriptionTitle={subscriptionTitle}
                  row={selected.row}
                  segment={selected.segment}
                  monthName={MONTHS_LONG[selected.at.month - 1]}
                  currency={currency}
                />
              ) : null}
              {selected.row.voidKind && selected.segment.paymentId && (selected.segment.status === "paid" || selected.segment.status === "partial") ? (
                <VoidAction
                  key={selected.segment.paymentId}
                  subscriptionId={subscriptionId}
                  paymentId={selected.segment.paymentId}
                  kind={selected.row.voidKind}
                  grouped={selected.segment.grouped}
                />
              ) : null}
            </>
          }
          onNavigate={() => setSelected(null)}
        />
      ) : null}
      {legendOpen ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[0.8125rem] text-muted" aria-label="Leyenda">
          {(Object.keys(STATUS) as InstallmentStatus[]).map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={`inline-flex size-5 items-center justify-center rounded-[6px] ${STATUS[status].className}`}>
                <Icon name={STATUS[status].icon} size="sm" />
              </span>
              {STATUS[status].label}
            </li>
          ))}
        </ul>
      ) : null}

    </div>
  );
}

interface Selection {
  row: CalendarRow;
  segment: CalendarSegment;
  at: CalendarMonth;
  /** Botón del mes tocado: el bocadillo se coloca respecto a él. */
  anchor: HTMLElement;
}

/**
 * Bocadillo flotante sobre el mes tocado, con el pico apuntándole. No ocupa
 * sitio en la tarjeta: es temporal y se cierra al tocar fuera.
 */
function Bubble({
  bubbleRef,
  selected,
  currency,
  payHref,
  extra,
  onNavigate,
}: {
  bubbleRef: React.RefObject<HTMLDivElement | null>;
  selected: Selection;
  currency: Currency;
  payHref: string | null;
  extra?: React.ReactNode;
  onNavigate: () => void;
}) {
  const info = details(selected.segment, currency);
  const style = STATUS[selected.segment.status];
  return (
    <div
      ref={bubbleRef}
      role="dialog"
      aria-label={`${selected.row.name}, ${MONTHS_LONG[selected.at.month - 1]}`}
      data-side="top"
      className="group/bubble fixed left-0 top-0 z-30 w-64 rounded-inner bg-ink p-3 text-small text-surface shadow-lg"
    >
      {/* Pico: abajo si el bocadillo está encima del mes; arriba si está debajo. */}
      <span
        aria-hidden="true"
        className="absolute -bottom-2 left-[var(--tail-x)] -ml-2 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-ink group-data-[side=bottom]/bubble:-top-2 group-data-[side=bottom]/bubble:bottom-auto group-data-[side=bottom]/bubble:border-b-8 group-data-[side=bottom]/bubble:border-t-0 group-data-[side=bottom]/bubble:border-b-ink"
      />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold">
            <Icon name={style.icon} size="sm" />
            {selected.row.name} · {MONTHS_LONG[selected.at.month - 1]}: {info.title}
          </p>
          <p className="mt-1">{info.first}</p>
          <p className="opacity-80">{info.second}</p>
        </div>
        {payHref ? (
          <Link
            href={payHref}
            scroll={false}
            onClick={onNavigate}
            className="-mr-1 -mt-1 inline-flex size-9 flex-none items-center justify-center rounded-full text-positive-soft hover:bg-surface/10"
          >
            <Icon name="plus" size="lg" label="Añadir pago" />
          </Link>
        ) : null}
      </div>
      {extra ? <div className="mt-2 flex flex-col items-start gap-2 border-t border-surface/15 pt-2 empty:hidden">{extra}</div> : null}
    </div>
  );
}

/**
 * Recordar un pago pendiente: a quien tiene cuenta le llega un aviso en la app;
 * a un invitado sin cuenta, se copia un mensaje para mandárselo por otro medio.
 */
function ReminderAction({
  subscriptionId,
  subscriptionTitle,
  row,
  segment,
  monthName,
  currency,
}: {
  subscriptionId: string;
  subscriptionTitle: string;
  row: CalendarRow;
  segment: CalendarSegment;
  monthName: string;
  currency: Currency;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const amount = formatMoney(Math.max(0, segment.due - segment.confirmed), currency);

  if (row.isGuest) {
    const text = `Hola, ${row.name}: te recuerdo que tienes pendiente el pago de ${monthName} de ${subscriptionTitle} (${amount}). ¡Gracias!`;
    return (
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(text).then(
            () => setState("done"),
            () => setState("error"),
          );
        }}
        className="flex items-center gap-1.5 font-semibold hover:underline"
      >
        <Icon name="send" size="sm" />
        {state === "done" ? "Mensaje copiado: pégalo donde le escribas" : state === "error" ? "No se pudo copiar" : "Copiar recordatorio"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending || state === "done"}
      onClick={() =>
        startTransition(async () => {
          setState("sending");
          const result = await sendPaymentReminder(subscriptionId, row.key, segment.from, Math.max(1, segment.due - segment.confirmed));
          setState(result.ok ? "done" : "error");
        })
      }
      className="flex items-center gap-1.5 font-semibold hover:underline disabled:no-underline disabled:opacity-80"
    >
      <Icon name="send" size="sm" />
      {state === "done"
        ? "Recordatorio enviado"
        : state === "error"
          ? "No se pudo enviar. Reintentar"
          : pending
            ? "Enviando…"
            : "Enviar recordatorio"}
    </button>
  );
}

/**
 * Borrar un pago anotado por error. En realidad se anula: deja de contar,
 * pero queda en el historial marcado como anulado. Pide confirmación.
 */
function VoidAction({
  subscriptionId,
  paymentId,
  kind,
  grouped,
}: {
  subscriptionId: string;
  paymentId: string;
  kind: "ledger" | "member";
  grouped: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="flex items-center gap-1.5 font-semibold text-negative-soft hover:underline">
        <Icon name="trash" size="sm" />
        Borrar este pago
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="opacity-80">
        {grouped ? "Se borra el pago entero (todos los meses que cubre)." : "Dejará de contar como pagado."} Quedará en el historial como
        anulado.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (kind === "member") {
                await voidMemberPayment(subscriptionId, paymentId);
              } else {
                const form = new FormData();
                form.set("idempotencyKey", crypto.randomUUID());
                await voidPayment(subscriptionId, paymentId, form);
              }
            })
          }
          className="font-semibold text-negative-soft hover:underline disabled:opacity-60"
        >
          {pending ? "Borrando…" : "Sí, borrar"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="font-semibold hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
