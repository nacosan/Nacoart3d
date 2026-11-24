"use client";

import { useActionState, useState } from "react";
import { changePrice, registerPayment, updateSubscription } from "@/app/(app)/suscripciones/actions";
import { Field } from "@/components/forms/Field";
import { PeriodsField } from "@/components/forms/PeriodsField";
import { FormMessage } from "@/components/forms/FormMessage";
import { EMPTY_FORM_STATE } from "@/components/forms/FormState";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CATEGORIES, CATEGORY_IDS } from "@/lib/catalog";
import { coverageOf } from "@/lib/finance/coverage";
import { centsToInput, formatMoney, parseAmountToCents, type Currency } from "@/lib/finance/money";

const CATEGORY_OPTIONS = CATEGORY_IDS.map((id) => ({ value: id, label: CATEGORIES[id].name }));

export interface EditableSubscription {
  id: string;
  name: string;
  nickname: string;
  category: string;
  status: string;
  cancelledOn: string;
  paidThrough: string;
  manageUrl: string;
  notes: string;
  participation: "owner" | "member";
  myShare: string;
  planOwnerName: string;
}

export function EditSubscriptionForm({ initial, today }: { initial: EditableSubscription; today: string }) {
  const [state, action] = useActionState(updateSubscription.bind(null, initial.id), EMPTY_FORM_STATE);
  const v = { ...initial, ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  const [status, setStatus] = useState(v.status);
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessage state={state} />
      <Field
        label="Nombre personalizado"
        name="nickname"
        error={e.nickname}
        optional
        hint="Por ejemplo, «Spotify de casa». Si lo pones, será el título y debajo verás qué es."
      >
        {(props) => <input {...props} name="nickname" maxLength={60} autoComplete="off" defaultValue={v.nickname} />}
      </Field>
      <Field label="Qué es (servicio y plan)" name="name" error={e.name}>
        {(props) => <input {...props} name="name" maxLength={80} required defaultValue={v.name} />}
      </Field>
      <Field label="Categoría" name="category" error={e.category}>
        {(props) => (
          <select {...props} name="category" defaultValue={v.category}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Estado" name="status" error={e.status}>
        {(props) => (
          <select {...props} name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">Activa</option>
            <option value="trial">En prueba</option>
            <option value="paused">Pausada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        )}
      </Field>
      {status === "cancelled" ? (
        <div className="grid gap-6 rounded-inner bg-raised p-4 sm:grid-cols-2 sm:p-5">
          <Field label="¿Cuándo la cancelaste?" name="cancelledOn" error={e.cancelledOn}>
            {(props) => <input {...props} name="cancelledOn" type="date" required defaultValue={v.cancelledOn || today} />}
          </Field>
          <Field label="Pagada hasta" name="paidThrough" error={e.paidThrough} optional hint="Último día que sigues teniendo el servicio.">
            {(props) => <input {...props} name="paidThrough" type="date" defaultValue={v.paidThrough} />}
          </Field>
        </div>
      ) : null}
      <input type="hidden" name="participation" value={initial.participation} />
      {initial.participation === "member" ? (
        <div className="grid gap-6 rounded-inner bg-raised p-4 sm:grid-cols-2 sm:p-5">
          <Field label="¿Cuánto pagas tú?" name="myShare" error={e.myShare} hint="Tu parte del precio total.">
            {(props) => <input {...props} name="myShare" inputMode="decimal" required defaultValue={v.myShare} />}
          </Field>
          <Field label="¿Quién paga el plan?" name="planOwnerName" error={e.planOwnerName} optional>
            {(props) => <input {...props} name="planOwnerName" maxLength={60} defaultValue={v.planOwnerName} />}
          </Field>
        </div>
      ) : null}
      <Field label="Enlace para gestionarla" name="manageUrl" error={e.manageUrl} optional>
        {(props) => <input {...props} name="manageUrl" type="url" inputMode="url" placeholder="https://" defaultValue={v.manageUrl} />}
      </Field>
      <Field label="Notas" name="notes" error={e.notes} optional>
        {(props) => <textarea {...props} name="notes" rows={3} maxLength={1000} defaultValue={v.notes} />}
      </Field>
      <p className="text-small text-muted">
        La periodicidad, la fecha de cobro y la moneda no se pueden cambiar porque reescribirían el pasado. Si cambian,
        cancela esta suscripción y crea otra. El precio se cambia desde el detalle.
      </p>
      <div className="flex flex-wrap gap-3">
        <SubmitButton icon="check">Guardar cambios</SubmitButton>
        <ButtonLink href={`/suscripciones/${initial.id}`} variant="ghost">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}

export function PriceForm({ id, today, currentAmount }: { id: string; today: string; currentAmount: string }) {
  const [state, action] = useActionState(changePrice.bind(null, id), EMPTY_FORM_STATE);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nuevo precio" name="amount" error={e.amount}>
          {(props) => <input {...props} name="amount" inputMode="decimal" required defaultValue={v.amount ?? currentAmount} />}
        </Field>
        <Field label="Desde" name="effectiveFrom" error={e.effectiveFrom}>
          {(props) => <input {...props} name="effectiveFrom" type="date" required defaultValue={v.effectiveFrom ?? today} />}
        </Field>
      </div>
      <div>
        <SubmitButton variant="secondary">Cambiar precio</SubmitButton>
      </div>
    </form>
  );
}

export function PaymentForm({
  id,
  idempotencyKey,
  today,
  defaultAmount,
  renewals,
  defaultRenewal,
  billingPeriod,
  currency,
}: {
  id: string;
  idempotencyKey: string;
  today: string;
  defaultAmount: string;
  /** Renovaciones sin pagar; title es el nombre del mes ("noviembre de 2026"). */
  renewals: { value: string; label: string; amount: string; title: string }[];
  defaultRenewal: string;
  billingPeriod: "monthly" | "yearly";
  currency: Currency;
}) {
  const [state, action] = useActionState(registerPayment.bind(null, id), EMPTY_FORM_STATE);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const [renewal, setRenewal] = useState(v.renewalDate ?? defaultRenewal);
  const [amount, setAmount] = useState(v.amount ?? (renewals.find((row) => row.value === defaultRenewal)?.amount || defaultAmount));
  const [periods, setPeriods] = useState(Number(v.periods ?? "1") || 1);
  // Importe de una renovación (la elegida o el precio actual) × renovaciones que cubre.
  const baseFor = (date: string) => renewals.find((row) => row.value === date)?.amount || defaultAmount;
  const scaled = (base: string, count: number) => {
    const cents = parseAmountToCents(base);
    return cents === null ? base : centsToInput(cents * count);
  };
  const chosen = renewals.find((row) => row.value === renewal);
  const cents = parseAmountToCents(amount);
  const coverage = chosen ? coverageOf(chosen.value, billingPeriod, periods) : null;
  // Si hay un error en algo de "Cambiar datos", se abre para verlo.
  const detailsOpen = Boolean(e.renewalDate || e.periods || e.amount || e.concept);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <FormMessage state={state} />

      <div className="rounded-inner bg-raised p-4">
        <p className="text-small text-muted">Vas a confirmar el pago de</p>
        <p className="text-body font-semibold">
          {chosen ? chosen.title : "un pago suelto"}
          {periods > 1 ? ` y ${periods - 1} ${periods - 1 === 1 ? "mes más" : "meses más"}` : ""}
        </p>
        <p className="text-figure font-bold tabular-nums">{cents === null ? amount || "—" : formatMoney(cents, currency)}</p>
        {coverage ? (
          <p className="mt-1 text-small font-semibold">{coverage.label}</p>
        ) : null}
      </div>

      <Field label="Fecha del pago" name="occurredOn" error={e.occurredOn}>
        {(props) => <input {...props} name="occurredOn" type="date" required max={today} defaultValue={v.occurredOn ?? today} />}
      </Field>

      <details open={detailsOpen} className="group rounded-inner border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-inner px-4 py-3 text-small font-semibold [&::-webkit-details-marker]:hidden">
          Cambiar datos
          <Icon name="chevronDown" className="text-muted" />
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          {renewals.length > 0 ? (
            <Field label="¿Qué renovación es?" name="renewalDate" error={e.renewalDate} optional>
              {(props) => (
                <select
                  {...props}
                  name="renewalDate"
                  value={renewal}
                  onChange={(event) => {
                    setRenewal(event.target.value);
                    setAmount(scaled(baseFor(event.target.value), periods));
                  }}
                >
                  <option value="">Ninguna en concreto</option>
                  {renewals.map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}
          <PeriodsField
            billingPeriod={billingPeriod}
            value={periods}
            error={e.periods}
            onChange={(count) => {
              setPeriods(count);
              setAmount(scaled(baseFor(renewal), count));
            }}
          />
          <Field label="Importe pagado" name="amount" error={e.amount}>
            {(props) => (
              <input {...props} name="amount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
            )}
          </Field>
          <Field label="Concepto" name="concept" error={e.concept} optional>
            {(props) => <input {...props} name="concept" maxLength={200} defaultValue={v.concept} />}
          </Field>
        </div>
      </details>

      <SubmitButton icon="check" pendingLabel="Guardando…" className="w-full">
        Confirmar pago
      </SubmitButton>
    </form>
  );
}
