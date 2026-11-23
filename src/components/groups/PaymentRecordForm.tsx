"use client";

import { useActionState, useState } from "react";
import { recordMemberPayment } from "@/app/(app)/grupos/actions";
import { Field } from "@/components/forms/Field";
import { FormMessage } from "@/components/forms/FormMessage";
import { EMPTY_FORM_STATE } from "@/components/forms/FormState";
import { SubmitButton } from "@/components/forms/SubmitButton";

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
}: {
  subscriptionId: string;
  members: PayableMember[];
  idempotencyKey: string;
  today: string;
  asMember: boolean;
}) {
  const [state, action] = useActionState(recordMemberPayment.bind(null, subscriptionId), EMPTY_FORM_STATE);
  const e = state.fieldErrors ?? {};
  const [memberId, setMemberId] = useState(state.values?.memberId ?? members[0]?.id ?? "");
  const member = members.find((item) => item.id === memberId);
  const [period, setPeriod] = useState(state.values?.renewalDate ?? member?.periods[0]?.date ?? "");
  const [amount, setAmount] = useState(state.values?.amount ?? member?.periods[0]?.amount ?? "");

  function chooseMember(id: string) {
    setMemberId(id);
    const first = members.find((item) => item.id === id)?.periods[0];
    setPeriod(first?.date ?? "");
    setAmount(first?.amount ?? "");
  }

  function choosePeriod(date: string) {
    setPeriod(date);
    const match = member?.periods.find((item) => item.date === date);
    if (match) setAmount(match.amount);
  }

  if (members.every((item) => item.periods.length === 0)) {
    return <p className="text-small text-muted">No hay nada pendiente de pago. ¡Todo al día!</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <FormMessage state={state} />
      {asMember ? (
        <input type="hidden" name="memberId" value={memberId} />
      ) : (
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
      <Field label="¿Qué mes paga?" name="renewalDate" error={e.renewalDate}>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Importe" name="amount" error={e.amount}>
          {(props) => (
            <input {...props} name="amount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
          )}
        </Field>
        <Field label="Fecha del pago" name="paidOn" error={e.paidOn}>
          {(props) => <input {...props} name="paidOn" type="date" required max={today} defaultValue={state.values?.paidOn ?? today} />}
        </Field>
      </div>
      <Field label="Nota" name="note" error={e.note} optional hint="Por ejemplo: Bizum, transferencia, efectivo.">
        {(props) => <input {...props} name="note" maxLength={200} defaultValue={state.values?.note} />}
      </Field>
      <p className="text-small text-muted">
        {asMember
          ? "Quien paga el plan tendrá que confirmarlo. Hasta entonces aparecerá como «por confirmar»."
          : "Queda confirmado al momento."}
      </p>
      <div>
        <SubmitButton icon="check" pendingLabel="Anotando…">
          {asMember ? "He enviado el pago" : "Anotar cobro"}
        </SubmitButton>
      </div>
    </form>
  );
}
