"use client";

import { useActionState, useState } from "react";
import { recordMemberPayment } from "@/app/(app)/grupos/actions";
import { Field } from "@/components/forms/Field";
import { FormMessage } from "@/components/forms/FormMessage";
import { EMPTY_FORM_STATE } from "@/components/forms/FormState";
import { PeriodsField } from "@/components/forms/PeriodsField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { centsToInput, formatMoney, parseAmountToCents, type Currency } from "@/lib/finance/money";
import { Icon } from "@/components/ui/Icon";

export interface PayableMember {
  id: string;
  name: string;
  /** Plazos sin pagar del todo, del más antiguo al más reciente. */
  periods: { date: string; label: string; amount: string }[];
}

/**
 * Anotar un pago de un miembro. El líder elige a la persona y queda confirmado;
 * un miembro solo puede declarar el suyo y queda por confirmar.
 */
export function PaymentRecordForm({
  subscriptionId,
  members,
  idempotencyKey,
  today,
  asMember,
  billingPeriod,
  defaultMemberId,
  defaultRenewal,
  currency,
}: {
  subscriptionId: string;
  members: PayableMember[];
  idempotencyKey: string;
  today: string;
  asMember: boolean;
  billingPeriod: "monthly" | "yearly";
  /** Persona y renovación elegidas al pulsar "Añadir pago" en el calendario. */
  defaultMemberId?: string;
  defaultRenewal?: string;
  currency: Currency;
}) {
  const [state, action] = useActionState(recordMemberPayment.bind(null, subscriptionId), EMPTY_FORM_STATE);
  const e = state.fieldErrors ?? {};
  const initialMember = members.find((item) => item.id === defaultMemberId && item.periods.length > 0) ?? members[0];
  const [memberId, setMemberId] = useState(state.values?.memberId ?? initialMember?.id ?? "");
  const member = members.find((item) => item.id === memberId);
  const initialPeriod = member?.periods.find((item) => item.date === defaultRenewal) ?? member?.periods[0];
  const [period, setPeriod] = useState(state.values?.renewalDate ?? initialPeriod?.date ?? "");
  const [amount, setAmount] = useState(state.values?.amount ?? initialPeriod?.amount ?? "");
  const [count, setCount] = useState(Number(state.values?.periods ?? "1") || 1);
  // Importe de una renovación × renovaciones que cubre el pago.
  const scaled = (base: string | undefined, periods: number) => {
    const cents = base ? parseAmountToCents(base) : null;
    return cents === null ? (base ?? "") : centsToInput(cents * periods);
  };

  function chooseMember(id: string) {
    setMemberId(id);
    const first = members.find((item) => item.id === id)?.periods[0];
    setPeriod(first?.date ?? "");
    setAmount(scaled(first?.amount, count));
  }

  function choosePeriod(date: string) {
    setPeriod(date);
    const match = member?.periods.find((item) => item.date === date);
    if (match) setAmount(scaled(match.amount, count));
  }

  if (members.every((item) => item.periods.length === 0)) {
    return <p className="text-small text-muted">No hay nada pendiente de pago. ¡Todo al día!</p>;
  }

  const chosen = member?.periods.find((item) => item.date === period);
  const cents = parseAmountToCents(amount);
  // Si hay un error en algo de "Cambiar datos", se abre para verlo.
  const detailsOpen = Boolean(e.memberId || e.renewalDate || e.periods || e.amount || e.note);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <FormMessage state={state} />
      {asMember ? <input type="hidden" name="memberId" value={memberId} /> : null}

      <div className="rounded-inner bg-raised p-4">
        <p className="text-small text-muted">{asMember ? "Vas a avisar de que has pagado" : `Vas a confirmar el pago de ${member?.name ?? ""}`}</p>
        <p className="text-body font-semibold">
          {chosen ? chosen.label.split(" · ")[0] : "—"}
          {count > 1 ? ` y ${count - 1} ${count - 1 === 1 ? "mes más" : "meses más"}` : ""}
        </p>
        <p className="text-figure font-bold tabular-nums">{cents === null ? amount || "—" : formatMoney(cents, currency)}</p>
      </div>

      <Field label="Fecha del pago" name="paidOn" error={e.paidOn}>
        {(props) => <input {...props} name="paidOn" type="date" required max={today} defaultValue={state.values?.paidOn ?? today} />}
      </Field>

      <details open={detailsOpen} className="rounded-inner border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-inner px-4 py-3 text-small font-semibold [&::-webkit-details-marker]:hidden">
          Cambiar datos
          <Icon name="chevronDown" className="text-muted" />
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          {asMember ? null : (
            <Field label="¿Quién ha pagado?" name="memberId" error={e.memberId}>
              {(props) => (
                <select {...props} name="memberId" value={memberId} onChange={(event) => chooseMember(event.target.value)}>
                  {members.map((item) => (
                    <option key={item.id} value={item.id} disabled={item.periods.length === 0}>
                      {item.name}
                      {item.periods.length === 0 ? " (al día)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label={count > 1 ? "¿Desde qué mes paga?" : "¿Qué mes paga?"} name="renewalDate" error={e.renewalDate}>
            {(props) => (
              <select {...props} name="renewalDate" value={period} onChange={(event) => choosePeriod(event.target.value)}>
                {(member?.periods ?? []).map((item) => (
                  <option key={item.date} value={item.date}>
                    {item.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <PeriodsField
            billingPeriod={billingPeriod}
            value={count}
            error={e.periods}
            onChange={(periods) => {
              setCount(periods);
              setAmount(scaled(member?.periods.find((item) => item.date === period)?.amount, periods));
            }}
          />
          <Field label="Importe" name="amount" error={e.amount}>
            {(props) => (
              <input {...props} name="amount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
            )}
          </Field>
          <Field label="Nota" name="note" error={e.note} optional hint="Por ejemplo: Bizum, transferencia, efectivo.">
            {(props) => <input {...props} name="note" maxLength={200} defaultValue={state.values?.note} />}
          </Field>
        </div>
      </details>

      <p className="text-small text-muted">
        {asMember
          ? "Quien paga el plan lo verá en su Resumen para confirmarlo. Hasta entonces aparecerá como «por confirmar»."
          : "Queda confirmado al momento."}
      </p>
      <SubmitButton icon="check" pendingLabel="Guardando…" className="w-full">
        {asMember ? "He enviado el pago" : "Confirmar pago"}
      </SubmitButton>
    </form>
  );
}
