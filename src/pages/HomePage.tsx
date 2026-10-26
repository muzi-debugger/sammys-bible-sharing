import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Feather, NotebookPen, Sparkles } from 'lucide-react';
import { useApp, useNow } from '@/context/AppContext';
import { Button, Card, Badge, SectionHeading } from '@/components/ui/primitives';
import { DailyEncouragementCard } from '@/components/DailyEncouragementCard';
import { CountdownCard } from '@/components/CountdownCard';
import { WeeklyCardSkeleton, WeeklyScriptureCard } from '@/components/WeeklyScriptureCard';
import { ReflectionModal } from '@/components/ReflectionModal';
import { ScripturePanel } from '@/components/ScripturePanel';
import { LeafCorner, DivineDivider, Sprig } from '@/components/Botanical';
import { InlineError, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { formatDayMonth, formatLongDate, parseIsoDate } from '@/lib/dates';
import { journalService } from '@/services/journal';
import { personalStudyService } from '@/services/personalStudy';
import type { ScripturePassage } from '@/types';

const REFLECTION_PROMPTS = [
  'What word or phrase stays with you as you read this again?',
  'Where does this passage meet your life this week?',
  'What would it look like to carry this into your day?',
  'Which line would you want to read aloud to your partner?',
  'What is one small thing you could do because of this verse?',
  'What does this passage reveal about how you are loved?',
];

const SUNDAY_PROMPTS = [
  'What stood out to you in your Scripture?',
  'What do you think this passage invites you to reflect on?',
  'What would you like to discuss with your partner?',
];

function greetingFor(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Africa/Johannesburg',
    }).format(now),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage() {
  const {
    user,
    partner,
    myAssignment,
    partnerAssignment,
    todayDaily,
    cycle,
    bootState,
    bootError,
    retryBootstrap,
  } = useApp();
  const navigate = useNavigate();
  const { notify } = useToast();
  const now = useNow(60_000);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflectionReference, setReflectionReference] = useState('Psalm 23:1-6');

  const prompt = useMemo(() => {
    const dayIndex = Math.floor(now.getTime() / 86_400_000);
    return REFLECTION_PROMPTS[dayIndex % REFLECTION_PROMPTS.length];
  }, [now]);

  const study = myAssignment
    ? personalStudyService.getForAssignment(user.id, myAssignment.id)
    : undefined;
  const hasWriting = personalStudyService.hasWriting(study);
  const preview = useMemo(() => {
    if (!study) return '';
    const text = [
      study.understanding,
      study.observations,
      study.lessonsLearned,
      study.questions,
      study.application,
      study.sundayDiscussionPoints,
    ]
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(' ');
    return text.length > 220 ? `${text.slice(0, 220).trimEnd()}…` : text;
  }, [study]);

  const openReflection = (reference: string) => {
    setReflectionReference(reference);
    setReflectionOpen(true);
  };

  const toggleBookmark = (passage: ScripturePassage) => {
    const existing = journalService.getBookmark(user.id, passage.reference);
    if (existing) {
      journalService.removeBookmark(user.id, existing.id);
      notify('Removed from your journal bookmarks.', 'info');
      return;
    }
    journalService.saveBookmark(user.id, passage);
    notify('Saved to your Scripture Journal.');
  };

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      notify(`Copied ${reference} to the clipboard.`, 'info');
    } catch {
      notify('Copying is blocked in this browser.', 'error');
    }
  };

  if (bootState === 'loading' && !todayDaily) {
    return <LoadingState label="Opening your devotional" />;
  }

  return (
    <div className="space-y-10 pb-4">
      <header className="animate-fade-up">
        <p className="eyebrow">{formatLongDate(now, 'Africa/Johannesburg')}</p>
        <h1 className="mt-3 font-serif text-[2rem] leading-[1.1] text-forest sm:text-[2.5rem]">
          {greetingFor(now)}, {user.name}.
        </h1>
        <p className="mt-2 max-w-reading font-serif text-[1.05rem] italic text-charcoal/60">
          Let&rsquo;s make room for the Word.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {myAssignment ? (
            <>
              <Badge tone="forest">
                <Sparkles size={10} /> Week of {formatDayMonth(parseIsoDate(myAssignment.weekStart))}
              </Badge>
              <Badge tone="sage">Your weekly Scriptures are ready</Badge>
            </>
          ) : (
            <Badge tone="gold">
              <CalendarDays size={10} /> {cycle ? 'This week is still being prepared' : 'Awaiting the Monday selection'}
            </Badge>
          )}
          <Badge tone="muted">NLT · preferred translation</Badge>
        </div>
      </header>

      {bootError ? <InlineError message={bootError} onRetry={retryBootstrap} /> : null}

      {/* Hero: today's Scripture */}
      {todayDaily ? (
        <Card
          tone="cream"
          className="relative overflow-hidden px-5 py-7 animate-fade-up sm:px-9 sm:py-10"
        >
          <LeafCorner className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 text-sage/35" />
          <div className="relative grid gap-8 lg:grid-cols-[1.6fr_0.9fr] lg:gap-10">
            <div>
              <p className="eyebrow">Today&rsquo;s Scripture</p>
              <div className="mt-4">
                <ScripturePanel
                  passage={todayDaily.passage}
                  size="large"
                  bookmarked={journalService.isBookmarked(user.id, todayDaily.passage.reference)}
                  onBookmark={() => toggleBookmark(todayDaily.passage)}
                  onCopyReference={() => void copyReference(todayDaily.passage.reference)}
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  icon={<Feather size={14} />}
                  onClick={() => openReflection(todayDaily.passage.reference)}
                >
                  Reflect on this verse
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => toggleBookmark(todayDaily.passage)}
                >
                  Save to journal
                </Button>
              </div>
            </div>

            <aside className="lg:border-l lg:border-sage/40 lg:pl-9">
              <p className="eyebrow">Take a moment to reflect</p>
              <p className="mt-3 font-serif text-[1.3rem] leading-[1.55] text-forest">{prompt}</p>
              <DivineDivider className="my-6" />
              <div className="space-y-3">
                <p className="font-sans text-[0.72rem] uppercase tracking-[0.14em] text-charcoal/40">
                  Today&rsquo;s theme
                </p>
                <p className="font-serif text-[1.1rem] text-terracotta">{todayDaily.theme}</p>
                <p className="font-sans text-[0.72rem] leading-relaxed text-charcoal/50">
                  One motivational passage is chosen each day from a curated collection of themes —
                  hope, love, wisdom, faith, courage, patience, gratitude, peace, perseverance and
                  forgiveness.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/journal')}
                className="mt-6 inline-flex items-center gap-1.5 font-sans text-[0.72rem] font-medium uppercase tracking-[0.14em] text-forest/70 transition-colors hover:text-forest"
              >
                Open your journal <ArrowRight size={12} />
              </button>
            </aside>
          </div>
        </Card>
      ) : (
        <Card tone="cream" className="p-8">
          <p className="eyebrow">Today&rsquo;s Scripture</p>
          <p className="mt-3 font-serif text-[1.3rem] text-forest">
            Today&rsquo;s encouragement is being prepared.
          </p>
          <p className="mt-2 font-sans text-[0.78rem] leading-relaxed text-charcoal/55">
            If the passage cannot be retrieved, your NLT preference is kept and nothing is
            substituted.
          </p>
        </Card>
      )}

      {/* Our Scriptures for Sunday */}
      <section className="space-y-5">
        <SectionHeading
          eyebrow="Our Scriptures for Sunday"
          title="Two passages, prepared for the two of you"
          description="Each week you each receive a different passage. Read yours during the week, then unpack both together on Sunday."
          action={
            <Button variant="ghost" size="sm" iconRight={<ArrowRight size={13} />} onClick={() => navigate('/weekly')}>
              This week
            </Button>
          }
        />
        <div className="grid gap-5 md:grid-cols-2">
          {myAssignment ? (
            <WeeklyScriptureCard assignment={myAssignment} partnerName={user.name} isOwn />
          ) : (
            <WeeklyCardSkeleton label={`${user.name}'s Scripture`} />
          )}
          {partnerAssignment ? (
            <WeeklyScriptureCard assignment={partnerAssignment} partnerName={partner.name} isOwn={false} />
          ) : (
            <WeeklyCardSkeleton label={`${partner.name}'s Scripture`} />
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        {todayDaily ? (
          <DailyEncouragementCard
            record={todayDaily}
            bookmarked={journalService.isBookmarked(user.id, todayDaily.passage.reference)}
            onToggleBookmark={() => toggleBookmark(todayDaily.passage)}
            onReflect={() => openReflection(todayDaily.passage.reference)}
          />
        ) : null}
        <CountdownCard />
      </div>

      {/* Make space for Sunday */}
      <Card className="relative overflow-hidden p-6 animate-fade-up sm:p-8">
        <Sprig className="pointer-events-none absolute -right-2 -top-6 h-40 w-28 rotate-[24deg] text-sage/20" />
        <div className="relative grid gap-7 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow">Make space for Sunday</p>
            <h2 className="mt-2 text-[1.5rem] leading-snug text-forest">
              Three quiet questions for the week
            </h2>
            <p className="mt-2 max-w-reading font-sans text-[0.82rem] leading-relaxed text-charcoal/55">
              You do not need answers today. These are simply doorways into your own notebook.
            </p>
            <Button
              className="mt-6"
              icon={<NotebookPen size={14} />}
              onClick={() => navigate('/sunday-study')}
            >
              Prepare for Sunday
            </Button>
          </div>
          <ol className="space-y-4">
            {SUNDAY_PROMPTS.map((item, index) => (
              <li key={item} className="flex gap-3 border-b border-sage/25 pb-4 last:border-0 last:pb-0">
                <span className="mt-0.5 font-serif text-[0.9rem] text-gold">
                  0{index + 1}
                </span>
                <p className="font-serif text-[1.02rem] leading-relaxed text-charcoal/75">{item}</p>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      {/* Your Sunday Study */}
      <section>
        <SectionHeading
          eyebrow="Your Sunday Study"
          title={`${user.name}'s private notebook`}
          description="Everything you write here stays yours. Your partner cannot read it."
        />
        <Card className="mt-5 grid gap-6 p-6 sm:p-7 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={hasWriting ? 'forest' : 'gold'}>
                {hasWriting
                  ? study?.isSample
                    ? 'Sample reflection saved'
                    : 'Your reflection is saved'
                  : "You haven't started your reflection yet"}
              </Badge>
              {myAssignment ? (
                <span className="font-serif text-[0.95rem] italic text-forest/80">
                  {myAssignment.passage.reference}
                </span>
              ) : null}
            </div>
            <p className="mt-4 max-w-[62ch] font-serif text-[1rem] leading-[1.9] text-charcoal/65">
              {hasWriting
                ? preview
                : 'Your notebook is ready. Open it whenever you have a quiet moment — there is no rush, and nothing to fill in correctly.'}
            </p>
            {hasWriting ? (
              <p className="mt-3 font-sans text-[0.66rem] uppercase tracking-[0.14em] text-charcoal/35">
                Preview of your own saved writing · never shown to {partner.name}
              </p>
            ) : null}
          </div>
          <Button
            full
            iconRight={<ArrowRight size={14} />}
            onClick={() => navigate('/sunday-study')}
            disabled={!myAssignment}
          >
            {hasWriting ? 'Continue My Study' : 'Open My Notebook'}
          </Button>
        </Card>
      </section>

      <ReflectionModal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
        reference={reflectionReference}
      />
    </div>
  );
}
