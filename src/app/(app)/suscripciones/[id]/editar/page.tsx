import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadProblem } from "@/components/app/LoadProblem";
import { EditSubscriptionForm } from "@/components/subscriptions/SubscriptionForms";
import { Icon } from "@/components/ui/Icon";
import { getProfile } from "@/lib/data/profile";
import { requireSession } from "@/lib/data/session";
import { getSubscription } from "@/lib/data/subscriptions";
import { centsToInput } from "@/lib/finance/money";
import { titleOf } from "@/lib/subscriptions/personal";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Editar suscripción · ManagSub" };

export default async function EditSubscriptionPage(props: PageProps<"/suscripciones/[id]/editar">) {
  const { id } = await props.params;
  const session = await requireSession();
  const profile = await getProfile(session);
  const result = await getSubscription(session, id);
  if (result.status !== "ok") return <LoadProblem status={result.status} retryHref={`/suscripciones/${id}/editar`} />;
  const sub = result.data;
  // Solo quien paga el plan puede editarlo.
  if (!sub || sub.role === "member") notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/suscripciones/${sub.id}`} className="inline-flex items-center gap-1 rounded-full text-small text-muted hover:text-ink">
        <Icon name="back" /> {titleOf(sub)}
      </Link>
      <h1 className="mt-3 text-title font-semibold">Editar suscripción</h1>
      <section className="mt-8 rounded-card bg-surface p-6 sm:p-9">
        <EditSubscriptionForm
          today={todayIn(profile.timezone)}
          initial={{
            id: sub.id,
            name: sub.name,
            nickname: sub.nickname ?? "",
            category: sub.categoryId,
            status: sub.status,
            cancelledOn: sub.cancelledOn ?? "",
            paidThrough: sub.paidThroughDate ?? "",
            manageUrl: sub.manageUrl ?? "",
            notes: sub.notes ?? "",
            participation: sub.participation,
            myShare: sub.myShareCents ? centsToInput(sub.myShareCents) : "",
            planOwnerName: sub.planOwnerName ?? "",
          }}
        />
      </section>
    </div>
  );
}
