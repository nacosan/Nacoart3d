import { Pill } from "@/components/atoms/Pill";
import { STATUS_LABEL, type SubscriptionStatus } from "@/lib/subscriptions/personal";

const TONE = {
  active: { tone: "positive", icon: "check" },
  trial: { tone: "accent", icon: "hourglass" },
  paused: { tone: "neutral", icon: "clock" },
  cancelled: { tone: "outline", icon: "close" },
} as const;

export function StatusPill({ status }: { status: SubscriptionStatus }) {
  const { tone, icon } = TONE[status];
  return (
    <Pill tone={tone} icon={icon}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}
