import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CalendarCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDayMonth, parseIsoDate } from '@/lib/dates';
import { passageExcerpt } from '@/services/passageFactory';
import { DeliveryStatus } from '@/components/DeliveryStatus';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { ScriptureReference, TranslationBadge } from '@/components/ScripturePanel';
import { LeafCorner } from '@/components/Botanical';
import type { WeeklyAssignment } from '@/types';

export function WeeklyScriptureCard({
  assignment,
  partnerName,
  isOwn,
}: {
  assignment: WeeklyAssignment;
  partnerName: string;
  isOwn: boolean;
}) {
  const navigate = useNavigate();

  return (
    <Card className="relative flex flex-col overflow-hidden p-6 sm:p-7" tone="paper">
      <LeafCorner className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rotate-180 text-sage/25" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="eyebrow">{partnerName}&rsquo;s Scripture</p>
        {isOwn ? <Badge tone="sage">Yours</Badge> : <Badge tone="muted">Partner</Badge>}
      </div>

      <div className="relative mt-4">
        <ScriptureReference reference={assignment.passage.reference} className="text-[1.45rem] leading-tight" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TranslationBadge
            translation={assignment.passage.translation}
            contentKind={assignment.passage.contentKind}
          />
          <span className="font-sans text-[0.66rem] uppercase tracking-[0.14em] text-charcoal/40">
            {assignment.theme}
          </span>
        </div>
      </div>

      <p className="relative mt-4 line-clamp-3 font-serif text-[0.98rem] leading-[1.85] text-charcoal/60">
        {passageExcerpt(assignment.passage, 150)}
      </p>

      <div className="relative mt-5 space-y-2 border-t border-sage/25 pt-4">
        <p className="flex items-center gap-2 font-sans text-[0.7rem] text-charcoal/55">
          <CalendarCheck size={12} className="text-forest/50" />
          Assigned {formatDayMonth(parseIsoDate(assignment.weekStart))}
        </p>
        <DeliveryStatus
          status={assignment.emailDelivery.status}
          detail={assignment.emailDelivery.detail}
        />
        <p className="flex items-center gap-2 font-sans text-[0.7rem] text-charcoal/55">
          <Sparkles size={12} className="text-gold" />
          {assignment.passage.contentKind === 'placeholder'
            ? 'Preview passage — NLT text pending'
            : 'NLT passage verified'}
        </p>
      </div>

      <Button
        variant="secondary"
        className="relative mt-5"
        full
        iconRight={<ArrowUpRight size={14} />}
        onClick={() => navigate(isOwn ? '/sunday-study' : '/weekly')}
      >
        Open Scripture
      </Button>
    </Card>
  );
}

export function WeeklyCardSkeleton({ label }: { label: string }) {
  return (
    <Card className={cn('flex min-h-[280px] flex-col justify-between p-6 sm:p-7')} tone="cream">
      <div>
        <p className="eyebrow">{label}</p>
        <p className="mt-4 font-serif text-[1.3rem] leading-snug text-forest/70">
          Two new Scriptures are being prepared for your Sunday study.
        </p>
      </div>
      <p className="font-sans text-[0.72rem] leading-relaxed text-charcoal/50">
        The Monday 10:00 GMT selection has not produced assignments for this week yet. Nothing has
        been fabricated in the meantime.
      </p>
    </Card>
  );
}
