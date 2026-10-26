import { CircleAlert, CircleCheck, CircleDashed, Clock, MailCheck, MailWarning } from 'lucide-react';
import { cn } from '@/lib/cn';
import { STATUS_LABELS } from '@/services/emailDelivery';
import type { DeliveryStatus } from '@/types';

const TONES: Record<DeliveryStatus, { colour: string; icon: React.ReactNode }> = {
  preview: { colour: 'text-charcoal/45', icon: <CircleDashed size={12} /> },
  queued: { colour: 'text-gold', icon: <Clock size={12} /> },
  accepted: { colour: 'text-forest/70', icon: <MailCheck size={12} /> },
  delivered: { colour: 'text-forest', icon: <CircleCheck size={12} /> },
  bounced: { colour: 'text-terracotta', icon: <MailWarning size={12} /> },
  failed: { colour: 'text-terracotta', icon: <CircleAlert size={12} /> },
};

export function DeliveryStatus({
  status,
  detail,
  className,
  showLabel = true,
}: {
  status: DeliveryStatus;
  detail?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const tone = TONES[status];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-sans text-[0.7rem] text-charcoal/60', className)}
      title={detail ?? STATUS_LABELS[status]}
    >
      <span className={tone.colour}>{tone.icon}</span>
      {showLabel ? <span>Email · {STATUS_LABELS[status]}</span> : null}
    </span>
  );
}
