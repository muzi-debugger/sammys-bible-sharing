import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronDown, Lock, Mail, NotebookPen } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Badge, Button, Card, SectionHeading } from '@/components/ui/primitives';
import { DeliveryStatus } from '@/components/DeliveryStatus';
import { ScripturePanel } from '@/components/ScripturePanel';
import { EmptyState } from '@/components/ui/states';
import { DivineDivider, Sprig } from '@/components/Botanical';
import {
  formatDayMonth,
  formatLongDate,
  parseIsoDate,
  startOfWeekUtc,
  toIsoDate,
  WEEK_RHYTHM,
} from '@/lib/dates';
import { scriptureAssignmentService } from '@/services/scriptureAssignment';
import { personalStudyService } from '@/services/personalStudy';
import { useToast } from '@/components/ui/Toast';
import type { WeeklyAssignment } from '@/types';

function RhythmTimeline({ activeWeek }: { activeWeek: boolean }) {
  return (
    <Card className="relative overflow-hidden p-6" tone="cream">
      <Sprig className="pointer-events-none absolute -bottom-5 right-1 h-36 w-24 rotate-12 text-sage/25" />
      <p className="eyebrow relative">The weekly rhythm</p>
      <ol className="relative mt-5 space-y-6">
        {WEEK_RHYTHM.map((step, index) => (
          <li key={step.day} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full border ${
                  activeWeek ? 'border-forest bg-forest' : 'border-sage bg-ivory'
                }`}
              />
              {index < WEEK_RHYTHM.length - 1 ? (
                <span className="mt-1 h-full w-px flex-1 bg-sage/50" />
              ) : null}
            </div>
            <div className="pb-1">
              <p className="font-sans text-[0.62rem] uppercase tracking-[0.18em] text-charcoal/45">
                {step.day}
              </p>
              <p className="mt-1 font-serif text-[1.1rem] text-forest">{step.title}</p>
              <p className="mt-1 font-sans text-[0.74rem] leading-relaxed text-charcoal/55">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <DivineDivider className="my-5" />
      <p className="relative font-sans text-[0.68rem] leading-relaxed text-charcoal/45">
        Assignments are stored against the weekly cycle. Refreshing never replaces them, and a
        retried delivery cannot create a duplicate.
      </p>
    </Card>
  );
}

function AssignmentPanel({
  assignment,
  partnerName,
  isOwn,
}: {
  assignment: WeeklyAssignment;
  partnerName: string;
  isOwn: boolean;
}) {
  const { user } = useApp();
  const navigate = useNavigate();
  const { notify } = useToast();
  const study = isOwn ? personalStudyService.getForAssignment(user.id, assignment.id) : undefined;
  const hasNotes = personalStudyService.hasWriting(study);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(assignment.passage.reference);
      notify(`Copied ${assignment.passage.reference}.`, 'info');
    } catch {
      notify('Copying is blocked in this browser.', 'error');
    }
  };

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{isOwn ? 'Your assignment' : `${partnerName}'s assignment`}</p>
          <h3 className="mt-2 font-serif text-[1.65rem] leading-tight text-forest">
            {partnerName}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">
            <CalendarDays size={10} /> {formatDayMonth(parseIsoDate(assignment.weekStart))}
          </Badge>
          <Badge tone="muted">{assignment.theme}</Badge>
        </div>
      </div>

      <div className="mt-5">
        <ScripturePanel
          passage={assignment.passage}
          onCopyReference={() => void copyReference()}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/sunday-study')}
              disabled={!isOwn}
              iconRight={<ArrowRight size={12} />}
            >
              {isOwn ? 'Open my notebook' : 'Notes stay private'}
            </Button>
          }
        />
      </div>

      <div className="mt-5 grid gap-3 rounded-journal border border-sage/30 bg-cream/30 p-4 sm:grid-cols-2">
        <div>
          <p className="font-sans text-[0.62rem] uppercase tracking-[0.16em] text-charcoal/40">
            Assigned
          </p>
          <p className="mt-1 font-sans text-[0.78rem] text-charcoal/70">
            {formatLongDate(parseIsoDate(assignment.weekStart), 'UTC')} · 10:00 GMT
          </p>
        </div>
        <div>
          <p className="font-sans text-[0.62rem] uppercase tracking-[0.16em] text-charcoal/40">
            Email delivery
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Mail size={11} className="text-charcoal/40" />
            <DeliveryStatus
              status={assignment.emailDelivery.status}
              detail={assignment.emailDelivery.detail}
            />
          </div>
        </div>
      </div>

      {isOwn ? (
        <div className="mt-4 rounded-journal border border-sage/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-sans text-[0.62rem] uppercase tracking-[0.16em] text-charcoal/40">
              {hasNotes ? 'Your private notes' : 'Your notebook'}
            </p>
            <Badge tone="sage">
              <Lock size={9} /> Only you
            </Badge>
          </div>
          <p className="mt-2 font-serif text-[0.95rem] leading-[1.85] text-charcoal/60">
            {hasNotes
              ? `${[study?.understanding, study?.observations].filter(Boolean).join(' ').slice(0, 190)}…`
              : "You haven't started your reflection for this week yet."}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 px-0"
            icon={<NotebookPen size={13} />}
            onClick={() => navigate('/sunday-study')}
          >
            {hasNotes ? 'Continue writing' : 'Start writing'}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-journal border border-sage/30 bg-cream/30 p-4">
          <Lock size={14} className="mt-0.5 shrink-0 text-forest/40" />
          <div>
            <p className="font-sans text-[0.62rem] uppercase tracking-[0.16em] text-charcoal/40">
              Personal notes
            </p>
            <p className="mt-1 font-sans text-[0.78rem] leading-relaxed text-charcoal/55">
              {partnerName}&rsquo;s notebook is private. Nothing written there is visible to you —
              you will talk it through together on Sunday.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

export function WeeklyScripturesPage() {
  const { db, user, partner, cycle, currentCycleId } = useApp();
  const cycles = useMemo(() => scriptureAssignmentService.listCycles(db), [db]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(cycle?.id ?? currentCycleId);

  const activeCycle = cycles.find((entry) => entry.id === selectedCycleId) ?? cycle;
  const assignments = activeCycle ? scriptureAssignmentService.getAssignments(activeCycle.id, db) : [];
  const ownAssignment = assignments.find((entry) => entry.partnerId === user.id);
  const partnerAssignment = assignments.find((entry) => entry.partnerId === partner.id);
  const isCurrentWeek = activeCycle
    ? activeCycle.weekStart === toIsoDate(startOfWeekUtc(new Date()))
    : false;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Our Weekly Scriptures</p>
          <h1 className="mt-3 font-serif text-[2rem] leading-tight text-forest sm:text-[2.4rem]">
            One week, two passages
          </h1>
          <p className="mt-2 max-w-reading font-sans text-[0.85rem] leading-relaxed text-charcoal/60">
            Two different Scriptures are chosen each Monday at 10:00 GMT and emailed individually.
            Prepare during the week, then unpack both together on Sunday.
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <label
            htmlFor="cycle-select"
            className="mb-1.5 block font-sans text-[0.62rem] uppercase tracking-[0.16em] text-charcoal/40"
          >
            Browse weeks
          </label>
          <div className="relative">
            <select
              id="cycle-select"
              value={activeCycle?.id ?? ''}
              onChange={(event) => setSelectedCycleId(event.target.value)}
              className="w-full appearance-none bg-none rounded-[10px] border border-sage/50 bg-soft-white py-2.5 pl-3.5 pr-9 font-sans text-[0.8rem] text-charcoal focus:border-forest/50 focus:outline-none sm:w-[240px]"
            >
              {cycles.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  Week of {formatDayMonth(parseIsoDate(entry.weekStart))}
                  {entry.id === currentCycleId ? ' · current' : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40"
            />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <RhythmTimeline activeWeek={isCurrentWeek} />
          <Card className="p-5" tone="paper">
            <p className="eyebrow">This week</p>
            <p className="mt-2 font-serif text-[1.15rem] text-forest">
              {activeCycle ? formatLongDate(parseIsoDate(activeCycle.weekStart), 'UTC') : '—'}
            </p>
            <p className="mt-1 font-sans text-[0.72rem] text-charcoal/45">
              Cycle {activeCycle?.id ?? '—'} · selection {activeCycle?.generatedAt ? 'generated' : 'pending'}
            </p>
            <DivineDivider className="my-4" />
            <div className="space-y-2">
              <p className="font-sans text-[0.72rem] leading-relaxed text-charcoal/55">
                {ownAssignment && partnerAssignment
                  ? 'Both passages are ready. They are guaranteed to be different references.'
                  : 'Waiting for the selection to complete.'}
              </p>
              <Badge tone={activeCycle?.origin === 'preview-simulation' ? 'gold' : 'sage'}>
                {activeCycle?.origin === 'preview-simulation' ? 'Preview-generated record' : 'Scheduled run'}
              </Badge>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {!activeCycle || assignments.length === 0 ? (
            <EmptyState
              title="Two new Scriptures are being prepared for your Sunday study."
              description="Once the Monday 10:00 GMT selection runs and both NLT passages are verified, your assignments will appear here. Nothing is fabricated in the meantime."
            />
          ) : (
            <>
              {ownAssignment ? (
                <AssignmentPanel assignment={ownAssignment} partnerName={user.name} isOwn />
              ) : null}
              {partnerAssignment ? (
                <AssignmentPanel assignment={partnerAssignment} partnerName={partner.name} isOwn={false} />
              ) : null}
              <SectionHeading
                title="A note on privacy"
                description="Passages are shared in the Sunday workspace. Personal notebooks never are."
                className="pt-2"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
