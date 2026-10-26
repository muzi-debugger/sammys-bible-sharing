import { Clock } from 'lucide-react';
import { useNow } from '@/context/AppContext';
import { countdownTo, formatDayMonth, nextSelectionDate } from '@/lib/dates';
import { Card } from '@/components/ui/primitives';
import { Sprig } from '@/components/Botanical';

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[2.6rem] rounded-[8px] border border-sage/35 bg-soft-white px-2 py-1.5 text-center font-serif text-[1.25rem] tabular-nums text-forest">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1.5 font-sans text-[0.56rem] uppercase tracking-[0.2em] text-charcoal/40">
        {label}
      </span>
    </div>
  );
}

export function CountdownCard() {
  const now = useNow(1000);
  const target = nextSelectionDate(now);
  const remaining = countdownTo(target, now);

  return (
    <Card className="relative overflow-hidden p-6" tone="paper">
      <Sprig className="pointer-events-none absolute -bottom-4 right-2 h-32 w-24 rotate-[14deg] text-sage/25" />
      <div className="relative">
        <p className="eyebrow">Next weekly selection</p>
        <p className="mt-2 font-serif text-[1.15rem] text-forest">Monday · 10:00 AM GMT</p>
        <p className="mt-1 font-sans text-[0.7rem] text-charcoal/45">
          That is 12:00 PM in South Africa · {formatDayMonth(target)}
        </p>

        <div className="mt-5 flex items-end gap-2.5">
          <Unit value={remaining.days} label="days" />
          <Unit value={remaining.hours} label="hrs" />
          <Unit value={remaining.minutes} label="min" />
          <Unit value={remaining.seconds} label="sec" />
        </div>

        <p className="mt-5 flex items-center gap-1.5 font-sans text-[0.66rem] leading-relaxed text-charcoal/45">
          <Clock size={11} className="text-gold" />
          Counted from the stored UTC schedule, not a decorative timer.
        </p>
      </div>
    </Card>
  );
}
