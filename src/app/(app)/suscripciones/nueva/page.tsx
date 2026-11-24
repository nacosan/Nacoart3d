import type { Metadata } from "next";
import Link from "next/link";
import { NewSubscriptionForm } from "@/components/organisms/subscriptions/NewSubscriptionForm";
import { getCatalog } from "@/lib/data/catalog";
import { Icon } from "@/components/atoms/Icon";
import { getProfile } from "@/lib/data/profile";
import { requireSession } from "@/lib/data/session";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Nueva suscripción · ManagSub" };

export default async function NewSubscriptionPage() {
  const session = await requireSession();
  const profile = await getProfile(session);
  const catalog = await getCatalog(session);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/suscripciones" className="inline-flex items-center gap-1 rounded-full text-small text-muted hover:text-ink">
        <Icon name="back" /> Suscripciones
      </Link>
      <h1 className="mt-3 text-title font-semibold">Nueva suscripción</h1>
      <p className="mt-1 text-body text-muted">Elige el servicio y te rellenamos el resto. Podrás cambiarlo después.</p>
      <section className="mt-8 rounded-card bg-surface p-6 sm:p-9">
        <NewSubscriptionForm
          catalog={catalog}
          idempotencyKey={crypto.randomUUID()}
          today={todayIn(profile.timezone)}
          currency={profile.currency}
        />
      </section>
    </div>
  );
}
