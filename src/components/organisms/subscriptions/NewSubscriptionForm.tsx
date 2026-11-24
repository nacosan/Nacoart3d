"use client";

import { useActionState, useMemo, useState } from "react";
import { createSubscription } from "@/app/(app)/suscripciones/actions";
import { ChoiceGroup, Field } from "@/components/molecules/Field";
import { FormMessage } from "@/components/molecules/FormMessage";
import { EMPTY_FORM_STATE } from "@/components/molecules/FormState";
import { SubmitButton } from "@/components/molecules/SubmitButton";
import { Button, ButtonLink } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { ServiceMark } from "@/components/atoms/ServiceMark";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/lib/catalog";
import type { CatalogPlan, CatalogService } from "@/lib/data/catalog";
import { formatDay } from "@/lib/finance/dates";
import { centsToInput, formatMoney, parseAmountToCents, type Currency } from "@/lib/finance/money";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function planPrice(plan: CatalogPlan): string {
  if (plan.priceCents === null) return "Precio sin verificar";
  return `${formatMoney(plan.priceCents, plan.currency)} ${plan.billingPeriod === "monthly" ? "al mes" : "al año"}`;
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function NewSubscriptionForm({
  catalog,
  idempotencyKey,
  today,
  currency,
}: {
  catalog: CatalogService[];
  idempotencyKey: string;
  today: string;
  currency: Currency;
}) {
  const [state, action] = useActionState(createSubscription, EMPTY_FORM_STATE);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};

  // Paso 1: servicio del catálogo o personalizada (null + custom).
  const [service, setService] = useState<CatalogService | null>(null);
  const [custom, setCustom] = useState(catalog.length === 0);
  const [plan, setPlan] = useState<CatalogPlan | null>(null);
  const [query, setQuery] = useState("");

  // Campos que rellena el plan (editables).
  const [name, setName] = useState(v.name ?? "");
  const [category, setCategory] = useState<CategoryId>("video");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [amount, setAmount] = useState(v.amount ?? "");
  const [money, setMoney] = useState<string>(currency);
  const [manageUrl, setManageUrl] = useState(v.manageUrl ?? "");

  // Compartir.
  const [shared, setShared] = useState(false);
  // En un plan compartido: lo pagas tú (propietario) o te lo paga otra persona (miembro).
  const [role, setRole] = useState<"owner" | "member">(v.participation === "member" ? "member" : "owner");
  const [myShare, setMyShare] = useState(v.myShare ?? "");
  const [maxMembers, setMaxMembers] = useState(v.maxMembers ?? "");
  const [guests, setGuests] = useState<string[]>([]);
  const [invites, setInvites] = useState<string[]>([]);
  const [guestDraft, setGuestDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);

  function choosePlan(next: CatalogPlan, owner: CatalogService) {
    setPlan(next);
    setName(`${owner.name} ${next.name}`);
    setCategory(owner.categoryId);
    setPeriod(next.billingPeriod);
    setAmount(next.priceCents === null ? "" : centsToInput(next.priceCents));
    setMoney(next.currency);
    setManageUrl(owner.website ?? "");
    setShared(next.isFamily);
    setMaxMembers(next.maxMembers && next.maxMembers >= 2 ? String(next.maxMembers) : "");
  }

  function chooseService(next: CatalogService) {
    setService(next);
    setCustom(false);
    if (next.plans.length === 1) choosePlan(next.plans[0], next);
    else setPlan(null);
  }

  function chooseCustom() {
    setService(null);
    setPlan(null);
    setCustom(true);
    setName("");
    setAmount("");
    setManageUrl("");
    setShared(false);
    setMaxMembers("");
  }

  function reset() {
    setService(null);
    setPlan(null);
    setCustom(false);
  }

  // Plazas: el máximo verificado del plan manda; si no, el que escribe la persona.
  const verifiedMax = plan?.maxMembers && plan.maxMembers >= 2 ? plan.maxMembers : null;
  const capacity = verifiedMax ?? (Number(maxMembers) >= 2 ? Number(maxMembers) : null);
  // Cualquier suscripción se puede compartir; en los planes familiares viene activado.
  const canShare = custom || plan !== null;
  const asOwner = shared && role === "owner";
  const asMember = shared && role === "member";
  const used = 1 + guests.length + invites.length;
  const full = capacity !== null && used >= capacity;

  function addGuest() {
    const value = guestDraft.trim();
    if (!value) return;
    if (value.length > 60) return setMemberError("El nombre puede tener hasta 60 caracteres.");
    if (full) return setMemberError("No caben más personas en el plan.");
    setGuests([...guests, value]);
    setGuestDraft("");
    setMemberError(null);
  }

  function addInvite() {
    const value = emailDraft.trim().toLowerCase();
    if (!value) return;
    if (!EMAIL.test(value)) return setMemberError("Ese email no es válido.");
    if (invites.includes(value)) return setMemberError("Ese email ya está en la lista.");
    if (full) return setMemberError("No caben más personas en el plan.");
    setInvites([...invites, value]);
    setEmailDraft("");
    setMemberError(null);
  }

  const cents = parseAmountToCents(amount);
  const sharePreview = asOwner && cents !== null && cents > 0 && guests.length > 0 ? Math.floor(cents / (1 + guests.length)) : null;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return catalog.filter((item) => !q || normalize(item.name).includes(q) || normalize(CATEGORIES[item.categoryId].name).includes(q));
  }, [catalog, query]);

  /* ---------------- Paso 1: elegir servicio ---------------- */
  if (!service && !custom) {
    return (
      <div className="flex flex-col gap-6">
        <div className="relative">
          <label htmlFor="buscar-servicio" className="sr-only">
            Buscar servicio
          </label>
          <input
            id="buscar-servicio"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca: Spotify, Netflix, PS Plus…"
            autoComplete="off"
            className="w-full rounded-full border border-border bg-surface px-5 py-3 text-body placeholder:text-muted/70 hover:border-control focus-visible:border-accent"
          />
        </div>

        <button
          type="button"
          onClick={chooseCustom}
          className="flex items-center gap-4 rounded-inner border border-dashed border-control bg-surface p-4 text-left hover:border-accent hover:bg-accent-soft"
        >
          <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-inner bg-accent-soft text-accent-ink">
            <Icon name="plus" size="lg" />
          </span>
          <span>
            <span className="block text-body font-semibold">Personalizada</span>
            <span className="block text-small text-muted">Para cualquier servicio que no esté en la lista.</span>
          </span>
        </button>

        {CATEGORY_IDS.map((categoryId) => {
          const items = filtered.filter((item) => item.categoryId === categoryId);
          if (items.length === 0) return null;
          return (
            <section key={categoryId} aria-labelledby={`cat-${categoryId}`}>
              <h2 id={`cat-${categoryId}`} className="mb-3 text-small font-semibold text-muted">
                {CATEGORIES[categoryId].name}
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => chooseService(item)}
                      className="flex w-full items-center gap-3 rounded-inner bg-raised p-3 text-left hover:bg-accent-soft"
                    >
                      <ServiceMark name={item.name} category={item.categoryId} />
                      <span className="min-w-0 truncate text-small font-semibold">{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {filtered.length === 0 ? (
          <p className="text-small text-muted">
            No encontramos «{query}». Usa <strong className="font-semibold">Personalizada</strong>.
          </p>
        ) : null}
      </div>
    );
  }

  /* ---------------- Paso 2: plan y datos ---------------- */
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="planId" value={plan?.id ?? ""} />
      <input type="hidden" name="participation" value={asMember ? "member" : "owner"} />
      {asOwner ? <input type="hidden" name="shared" value="on" /> : null}
      {asOwner ? guests.map((guest, index) => <input key={`g${index}`} type="hidden" name="guests" value={guest} />) : null}
      {asOwner ? invites.map((email) => <input key={email} type="hidden" name="invites" value={email} />) : null}
      {asOwner && verifiedMax ? <input type="hidden" name="maxMembers" value={verifiedMax} /> : null}

      <div className="flex items-center justify-between gap-3 rounded-inner bg-raised p-3">
        <span className="flex min-w-0 items-center gap-3">
          {service ? (
            <ServiceMark name={service.name} category={service.categoryId} />
          ) : (
            <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink">
              <Icon name="plus" />
            </span>
          )}
          <span className="truncate text-body font-semibold">{service ? service.name : "Personalizada"}</span>
        </span>
        <Button variant="ghost" icon="back" className="h-9 px-3" onClick={reset}>
          Cambiar
        </Button>
      </div>

      <FormMessage state={state} />

      {service && service.plans.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-small font-semibold">¿Qué plan tienes?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {service.plans.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer flex-col gap-0.5 rounded-control border border-border bg-surface px-4 py-3 hover:border-control has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent"
              >
                <span className="flex items-center gap-2 text-small font-semibold">
                  <input
                    type="radio"
                    name="planChoice"
                    checked={plan?.id === option.id}
                    onChange={() => choosePlan(option, service)}
                    className="size-4 accent-primary focus-visible:outline-none"
                  />
                  {option.name}
                  {option.isFamily ? <span className="rounded-full bg-lila-soft px-2 text-[0.75rem] text-lila-ink">Familiar</span> : null}
                </span>
                <span className="pl-6 text-small text-muted">
                  {planPrice(option)}
                  {option.maxMembers && option.maxMembers > 1 ? ` · hasta ${option.maxMembers} personas` : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {service && !plan ? null : (
        <>
          {plan ? (
            <p className="flex items-start gap-2 rounded-inner bg-raised px-4 py-3 text-small text-muted">
              <Icon name="info" className="mt-0.5 text-accent-ink" />
              <span>
                {plan.priceCents !== null && plan.verifiedOn ? (
                  <>
                    Precio de la web oficial a {formatDay(plan.verifiedOn, true)}. Si pagas otra cosa, cámbialo.
                  </>
                ) : (
                  <>Precio sin verificar. Indica el tuyo.</>
                )}
                {plan.conditions ? <span className="mt-1 block">Condiciones: {plan.conditions}</span> : null}
              </span>
            </p>
          ) : null}

          <Field label={custom ? "¿Qué servicio es?" : "Qué es (servicio y plan)"} name="name" error={e.name}>
            {(props) => (
              <input {...props} name="name" maxLength={80} required autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </Field>

          <Field label="Nombre personalizado" name="nickname" error={e.nickname} optional>
            {(props) => (
              <input {...props} name="nickname" maxLength={60} autoComplete="off" placeholder="Nombre personalizado" defaultValue={v.nickname} />
            )}
          </Field>

          {custom ? (
            <Field label="Categoría" name="category" error={e.category}>
              {(props) => (
                <select {...props} name="category" value={category} onChange={(event) => setCategory(event.target.value as CategoryId)}>
                  {CATEGORY_IDS.map((id) => (
                    <option key={id} value={id}>
                      {CATEGORIES[id].name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <input type="hidden" name="category" value={category} />
          )}

          {custom ? (
            <ChoiceGroup
              legend="¿Cada cuánto pagas?"
              name="period"
              defaultValue={period}
              error={e.period}
              options={[
                { value: "monthly", label: "Cada mes" },
                { value: "yearly", label: "Cada año" },
              ]}
            />
          ) : (
            <input type="hidden" name="period" value={period} />
          )}

          <div className="grid gap-6 sm:grid-cols-[1fr_9rem]">
            <Field
              label="Importe"
              name="amount"
              error={e.amount}
              hint={shared ? "Precio total del plan" : undefined}
            >
              {(props) => (
                <input
                  {...props}
                  name="amount"
                  inputMode="decimal"
                  placeholder="12,99"
                  required
                  autoComplete="off"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              )}
            </Field>
            <Field label="Moneda" name="currency" error={e.currency}>
              {(props) => (
                <select {...props} name="currency" value={money} onChange={(event) => setMoney(event.target.value)}>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              )}
            </Field>
          </div>

          <Field
            label="Fecha de renovación"
            name="anchor"
            error={e.anchor}
          >
            {(props) => <input {...props} name="anchor" type="date" required defaultValue={v.anchor ?? today} />}
          </Field>

          {canShare ? (
            <section aria-labelledby="compartir" className="flex flex-col gap-4 rounded-inner border border-border p-4 sm:p-5">
              <h2 id="compartir" className="sr-only">
                Compartir
              </h2>
              <button
                type="button"
                role="switch"
                aria-checked={shared}
                onClick={() => setShared(!shared)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <span>
                  <span className="block text-body font-semibold">La comparto con otras personas</span>
                  <span className="block text-small text-muted">Lo usáis varias personas y os repartís el precio.</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`inline-flex h-7 w-12 flex-none items-center rounded-full p-0.5 transition-colors duration-150 ${
                    shared ? "justify-end bg-primary" : "justify-start bg-control"
                  }`}
                >
                  <span className="size-6 rounded-full bg-white shadow" />
                </span>
              </button>

              {shared ? (
                <fieldset>
                  <legend className="mb-2 text-small font-semibold">¿Quién paga el plan?</legend>
                  <div className="grid grid-cols-2 gap-1 rounded-full bg-active p-1">
                    {(
                      [
                        { value: "owner", label: "Yo (propietario)" },
                        { value: "member", label: "Otra persona (miembro)" },
                      ] as const
                    ).map((option) => (
                      <label
                        key={option.value}
                        className="flex min-h-10 cursor-pointer items-center justify-center rounded-full px-3 text-center text-small leading-tight text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
                      >
                        <input
                          type="radio"
                          name="roleChoice"
                          value={option.value}
                          checked={role === option.value}
                          onChange={() => setRole(option.value)}
                          className="sr-only"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {asMember ? (
                <div className="flex flex-col gap-4">
                  <Field
                    label="¿Cuánto pagas tú?"
                    name="myShare"
                    error={e.myShare}
                    hint={`Tu parte del precio total, ${period === "monthly" ? "cada mes" : "cada año"}. Es lo que contará como tu gasto.`}
                  >
                    {(props) => (
                      <input
                        {...props}
                        name="myShare"
                        inputMode="decimal"
                        required
                        autoComplete="off"
                        placeholder={cents && verifiedMax ? centsToInput(Math.floor(cents / verifiedMax)) : "3,50"}
                        value={myShare}
                        onChange={(event) => setMyShare(event.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="¿Quién paga el plan?" name="planOwnerName" error={e.planOwnerName} optional>
                    {(props) => (
                      <input {...props} name="planOwnerName" maxLength={60} autoComplete="off" placeholder="Nombre" defaultValue={v.planOwnerName} />
                    )}
                  </Field>
                  <p className="text-small text-muted">
                    Si esa persona usa la app, es mejor que te invite desde su suscripción: así verás el grupo y tu parte
                    automáticamente.
                  </p>
                </div>
              ) : null}

              {asOwner ? (
                <div className="flex flex-col gap-4">
                  {verifiedMax ? (
                    <p className="text-small text-muted">Este plan admite hasta {verifiedMax} personas, contándote a ti.</p>
                  ) : (
                    <Field label="¿Cuántas personas caben, contándote?" name="maxMembers" error={e.maxMembers}>
                      {(props) => (
                        <input
                          {...props}
                          name="maxMembers"
                          type="number"
                          inputMode="numeric"
                          min={2}
                          max={20}
                          required
                          value={maxMembers}
                          onChange={(event) => setMaxMembers(event.target.value)}
                        />
                      )}
                    </Field>
                  )}

                  <div>
                    <p className="text-small font-semibold">
                      Personas{" "}
                      <span className="font-normal text-muted">
                        · {used}
                        {capacity ? ` de ${capacity}` : ""} plazas
                      </span>
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      <li className="inline-flex h-9 items-center rounded-full bg-accent-soft px-3 text-small font-medium text-accent-ink">Tú</li>
                      {guests.map((guest, index) => (
                        <li key={`g${index}`} className="inline-flex h-9 items-center gap-1 rounded-full bg-raised pl-3 pr-1 text-small">
                          {guest} <span className="text-muted">· sin cuenta</span>
                          <button
                            type="button"
                            onClick={() => setGuests(guests.filter((_, i) => i !== index))}
                            className="inline-flex size-7 items-center justify-center rounded-full hover:bg-active"
                          >
                            <Icon name="close" size="sm" label={`Quitar a ${guest}`} />
                          </button>
                        </li>
                      ))}
                      {invites.map((email) => (
                        <li key={email} className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-control pl-3 pr-1 text-small">
                          {email} <span className="text-muted">· invitación</span>
                          <button
                            type="button"
                            onClick={() => setInvites(invites.filter((item) => item !== email))}
                            className="inline-flex size-7 items-center justify-center rounded-full hover:bg-active"
                          >
                            <Icon name="close" size="sm" label={`Quitar a ${email}`} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="nuevo-invitado" className="text-small font-semibold">
                        Alguien sin cuenta
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="nuevo-invitado"
                          value={guestDraft}
                          onChange={(event) => setGuestDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addGuest();
                            }
                          }}
                          placeholder="Nombre"
                          maxLength={60}
                          disabled={full}
                          className="min-w-0 flex-1 rounded-control border border-border bg-surface px-4 py-2.5 text-body hover:border-control focus-visible:border-accent disabled:bg-active"
                        />
                        <Button onClick={addGuest} disabled={full || !guestDraft.trim()}>
                          Añadir
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="nuevo-email" className="text-small font-semibold">
                        Alguien con cuenta (por email)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="nuevo-email"
                          type="email"
                          value={emailDraft}
                          onChange={(event) => setEmailDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addInvite();
                            }
                          }}
                          placeholder="email@ejemplo.com"
                          autoComplete="off"
                          disabled={full}
                          className="min-w-0 flex-1 rounded-control border border-border bg-surface px-4 py-2.5 text-body hover:border-control focus-visible:border-accent disabled:bg-active"
                        />
                        <Button onClick={addInvite} disabled={full || !emailDraft.trim()}>
                          Invitar
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-small text-muted">
                    Las personas con cuenta reciben una invitación y entran en el grupo cuando la aceptan. Hasta entonces
                    reservan su plaza pero no cuentan en el reparto.
                  </p>
                  <div aria-live="polite">
                    {memberError || e.members ? (
                      <p className="text-small font-medium text-negative-ink">{memberError ?? e.members}</p>
                    ) : null}
                    {sharePreview !== null ? (
                      <p className="text-small">
                        Entre {1 + guests.length} personas, a cada una le tocan unos{" "}
                        <strong className="font-semibold">{formatMoney(sharePreview, money as Currency)}</strong>{" "}
                        {custom ? "cada vez" : period === "monthly" ? "al mes" : "al año"}.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <ChoiceGroup
            legend="Estado"
            name="status"
            defaultValue={v.status ?? "active"}
            error={e.status}
            options={[
              { value: "active", label: "Activa" },
              { value: "trial", label: "En prueba" },
              { value: "paused", label: "Pausada", hint: "No cuenta en el gasto" },
            ]}
          />

          <details className="rounded-inner bg-raised">
            <summary className="cursor-pointer rounded-inner px-4 py-3 text-small font-semibold">Más opciones</summary>
            <div className="flex flex-col gap-6 px-4 pb-4">
              <Field label="Enlace para gestionarla" name="manageUrl" error={e.manageUrl} optional hint="La página donde cambias o cancelas el plan.">
                {(props) => (
                  <input
                    {...props}
                    name="manageUrl"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={manageUrl}
                    onChange={(event) => setManageUrl(event.target.value)}
                  />
                )}
              </Field>
              <Field label="Notas" name="notes" error={e.notes} optional>
                {(props) => <textarea {...props} name="notes" rows={3} maxLength={1000} defaultValue={v.notes} />}
              </Field>
            </div>
          </details>

          <div className="flex flex-wrap gap-3">
            <SubmitButton icon="check">Guardar suscripción</SubmitButton>
            <ButtonLink href="/suscripciones" variant="ghost">
              Cancelar
            </ButtonLink>
          </div>
        </>
      )}
    </form>
  );
}
