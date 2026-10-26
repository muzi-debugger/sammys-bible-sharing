import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  Eye,
  Feather,
  Lock,
  PenLine,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useApp } from '@/context/AppContext';
import { Badge, Button, Card, SectionHeading } from '@/components/ui/primitives';
import { ScripturePanel, TranslationBadge } from '@/components/ScripturePanel';
import { SaveStatus, type SaveState } from '@/components/SaveStatus';
import { EmptyState } from '@/components/ui/states';
import { DivineDivider, LeafCorner, Sprig } from '@/components/Botanical';
import { useToast } from '@/components/ui/Toast';
import { formatDayMonth, formatLongDate, formatTimestamp, parseIsoDate } from '@/lib/dates';
import { personalStudyService, type SharedFields, type StudyFields } from '@/services/personalStudy';
import type { PersonalStudy, WeeklyAssignment } from '@/types';

type Tab = 'notebook' | 'shared' | 'both';

interface PromptDefinition {
  key: keyof StudyFields;
  label: string;
  hint: string;
}

const PROMPTS: PromptDefinition[] = [
  {
    key: 'observations',
    label: 'What stood out to me',
    hint: 'Which words, ideas, or verses caught your attention?',
  },
  {
    key: 'lessonsLearned',
    label: 'What I learned',
    hint: 'What does this passage teach you about faith, life, or your relationship with God?',
  },
  {
    key: 'questions',
    label: 'Questions I have',
    hint: 'What would you like to understand better?',
  },
  {
    key: 'application',
    label: 'How I can apply it',
    hint: 'What practical change or action can you take this week?',
  },
  {
    key: 'sundayDiscussionPoints',
    label: 'What I want to share on Sunday',
    hint: 'What are the main points you want to discuss with your partner?',
  },
];

const EMPTY_FIELDS: StudyFields = {
  understanding: '',
  observations: '',
  lessonsLearned: '',
  questions: '',
  application: '',
  sundayDiscussionPoints: '',
};

function pickFields(study: PersonalStudy): StudyFields {
  return {
    understanding: study.understanding,
    observations: study.observations,
    lessonsLearned: study.lessonsLearned,
    questions: study.questions,
    application: study.application,
    sundayDiscussionPoints: study.sundayDiscussionPoints,
  };
}

function fieldsDiffer(a: StudyFields, b: StudyFields): boolean {
  return (
    a.understanding !== b.understanding ||
    a.observations !== b.observations ||
    a.lessonsLearned !== b.lessonsLearned ||
    a.questions !== b.questions ||
    a.application !== b.application ||
    a.sundayDiscussionPoints !== b.sundayDiscussionPoints
  );
}

function StudyHeader({
  assignment,
  partnerName,
  tab,
  onTabChange,
}: {
  assignment: WeeklyAssignment | undefined;
  partnerName: string;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const tabs: Array<{ id: Tab; label: string; icon: typeof Feather }> = [
    { id: 'notebook', label: 'My Notebook', icon: PenLine },
    { id: 'shared', label: 'Our Shared Takeaways', icon: Users },
    { id: 'both', label: 'Both Scriptures', icon: BookOpen },
  ];

  return (
    <header className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Sunday Study</p>
          <h1 className="mt-3 font-serif text-[2rem] leading-tight text-forest sm:text-[2.5rem]">
            My Sunday Study
          </h1>
          <p className="mt-2 max-w-reading font-serif text-[1.02rem] italic text-charcoal/60">
            Two Scriptures. Two perspectives. One conversation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {assignment ? (
            <>
              <Badge tone="gold">
                {formatLongDate(parseIsoDate(assignment.weekStart), 'UTC')}
              </Badge>
              <Badge tone="forest">{assignment.passage.reference}</Badge>
              <Badge tone="muted">New Living Translation</Badge>
            </>
          ) : (
            <Badge tone="muted">No assignment for this week</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-sage/30 pb-3">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onTabChange(entry.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 font-sans text-[0.78rem] transition-colors duration-300',
              tab === entry.id
                ? 'border-forest bg-forest text-ivory'
                : 'border-sage/45 text-charcoal/60 hover:border-forest/40 hover:text-forest',
            )}
          >
            <entry.icon size={12} />
            {entry.label}
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-1.5 font-sans text-[0.66rem] text-charcoal/40 sm:flex">
          <Lock size={11} className="text-forest/40" />
          Only you can read your notebook · {partnerName}&rsquo;s stays private too
        </span>
      </div>
    </header>
  );
}

function ReadingView({
  values,
  assignment,
  onExit,
}: {
  values: StudyFields;
  assignment: WeeklyAssignment;
  onExit: () => void;
}) {
  const sections: PromptDefinition[] = [{ key: 'understanding', label: 'What this passage means to me', hint: '' }, ...PROMPTS];
  const filled = sections.filter((section) => values[section.key].trim().length > 0);

  return (
    <Card className="relative overflow-hidden p-6 animate-fade-up sm:p-10">
      <Sprig className="pointer-events-none absolute -right-3 top-4 h-40 w-28 rotate-[18deg] text-sage/20" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Reading mode · {assignment.passage.reference}</p>
          <Button variant="secondary" size="sm" icon={<PenLine size={13} />} onClick={onExit}>
            Back to Editing
          </Button>
        </div>
        <h2 className="mt-4 font-serif text-[1.9rem] leading-tight text-forest">My notes</h2>
        <p className="mt-1 font-sans text-[0.72rem] uppercase tracking-[0.14em] text-charcoal/40">
          {formatLongDate(parseIsoDate(assignment.weekStart), 'UTC')} · New Living Translation (NLT)
        </p>

        <DivineDivider className="my-7" />

        {filled.length === 0 ? (
          <p className="font-serif text-[1.1rem] italic text-charcoal/50">
            Your notebook is still empty. Return to editing whenever you are ready — there is no
            rush.
          </p>
        ) : (
          <div className="space-y-8">
            {filled.map((section) => (
              <section key={section.key}>
                <h3 className="font-sans text-[0.68rem] uppercase tracking-[0.18em] text-charcoal/40">
                  {section.label}
                </h3>
                <div className="mt-2 space-y-3">
                  {values[section.key]
                    .split(/\n{2,}/)
                    .filter(Boolean)
                    .map((paragraph, index) => (
                      <p
                        key={index}
                        className="font-serif text-[1.18rem] leading-[1.95] text-charcoal/85 whitespace-pre-line"
                      >
                        {paragraph}
                      </p>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-sage/25 pt-5">
          <p className="font-sans text-[0.66rem] text-charcoal/40">
            This reading view is private to you.
          </p>
          <Button variant="secondary" size="sm" onClick={onExit} icon={<PenLine size={13} />}>
            Back to Editing
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function SundayStudyPage() {
  const { db, user, partner, myAssignment, partnerAssignment, cycle, settings } = useApp();
  const { notify } = useToast();
  const navigate = useNavigate();

  const myAssignments = useMemo(
    () =>
      db.assignments
        .filter((assignment) => assignment.partnerId === user.id)
        .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)),
    [db.assignments, user.id],
  );

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const assignment =
    myAssignments.find((entry) => entry.id === selectedId) ?? myAssignment ?? myAssignments[0];

  const [tab, setTab] = useState<Tab>('notebook');
  const [study, setStudy] = useState<PersonalStudy | undefined>(undefined);
  const [values, setValues] = useState<StudyFields>(EMPTY_FIELDS);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [readingMode, setReadingMode] = useState(false);
  const [openPrompts, setOpenPrompts] = useState<Set<string>>(new Set());
  const [sharedValues, setSharedValues] = useState<SharedFields>({
    mainLesson: '',
    practicalCommitment: '',
    closingPrayer: '',
  });
  const [sharedSavedAt, setSharedSavedAt] = useState<string | undefined>(undefined);

  const timerRef = useRef<number | null>(null);
  const valuesRef = useRef(values);
  const studyRef = useRef(study);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  useEffect(() => {
    studyRef.current = study;
  }, [study]);

  // Load (or create) the notebook for the selected week.
  useEffect(() => {
    if (!assignment) {
      setStudy(undefined);
      return;
    }
    const ensured = personalStudyService.ensureForAssignment(user.id, assignment);
    setStudy(ensured);
    setValues(pickFields(ensured));
    setLastSavedAt(ensured.updatedAt);
    setSaveState('idle');
    setReadingMode(false);
    setOpenPrompts(new Set());
  }, [assignment?.id, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(async () => {
    const current = studyRef.current;
    if (!current) return;
    setSaveState('saving');
    try {
      const updated = await personalStudyService.save(user.id, current.id, valuesRef.current);
      setStudy(updated);
      setLastSavedAt(updated.updatedAt);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [user.id]);

  // Debounced autosave — only fires when the draft actually differs from storage.
  useEffect(() => {
    if (!study) return;
    if (!fieldsDiffer(values, pickFields(study))) return;
    setSaveState('unsaved');
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void persist(), 900);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [values, study, persist]);

  // Best-effort flush so navigating away never loses unsaved writing.
  useEffect(() => {
    return () => {
      const current = studyRef.current;
      if (!current) return;
      if (fieldsDiffer(valuesRef.current, pickFields(current))) {
        void personalStudyService
          .save(user.id, current.id, valuesRef.current)
          .catch(() => {
            /* the error state is surfaced in the editor */
          });
      }
    };
  }, [user.id]);

  const sharedRecord = cycle ? personalStudyService.getSharedTakeaway(cycle.id) : undefined;

  useEffect(() => {
    setSharedValues({
      mainLesson: sharedRecord?.mainLesson ?? '',
      practicalCommitment: sharedRecord?.practicalCommitment ?? '',
      closingPrayer: sharedRecord?.closingPrayer ?? '',
    });
    setSharedSavedAt(sharedRecord?.updatedAt);
  }, [cycle?.id, sharedRecord?.updatedAt, sharedRecord?.mainLesson, sharedRecord?.practicalCommitment, sharedRecord?.closingPrayer]);

  const togglePrompt = (key: string) => {
    setOpenPrompts((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveShared = () => {
    if (!cycle) return;
    const saved = personalStudyService.saveSharedTakeaway(user.id, cycle.id, sharedValues);
    setSharedSavedAt(saved.updatedAt);
    notify('Shared takeaways saved for the two of you.');
  };

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      notify(`Copied ${reference}.`, 'info');
    } catch {
      notify('Copying is blocked in this browser.', 'error');
    }
  };

  if (!assignment) {
    return (
      <div className="space-y-6">
        <StudyHeader assignment={undefined} partnerName={partner.name} tab={tab} onTabChange={setTab} />
        <EmptyState
          title="Your notebook is waiting for a Scripture."
          description="Once this week's selection has run, your personal study page will open here with your assigned passage."
          action={<Button variant="secondary" onClick={() => navigate('/weekly')}>See the weekly Scriptures</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <StudyHeader
        assignment={assignment}
        partnerName={partner.name}
        tab={tab}
        onTabChange={setTab}
      />

      {tab === 'notebook' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
          <div className="space-y-6">
            <Card tone="cream" className="relative overflow-hidden p-5 sm:p-7">
              <LeafCorner className="pointer-events-none absolute -bottom-8 -right-8 h-44 w-44 text-sage/30" />
              <div className="relative">
                <ScripturePanel
                  passage={assignment.passage}
                  size="large"
                  onCopyReference={() => void copyReference(assignment.passage.reference)}
                />
                <p className="mt-5 border-t border-sage/30 pt-4 font-serif text-[0.98rem] leading-relaxed italic text-charcoal/60">
                  Take your time with the passage. Write what you understand, what stands out to
                  you, and what you want to discuss on Sunday.
                </p>
              </div>
            </Card>

            {readingMode ? (
              <ReadingView values={values} assignment={assignment} onExit={() => setReadingMode(false)} />
            ) : (
              <Card className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-[1.55rem] leading-tight text-forest">
                      What does this passage mean to me?
                    </h2>
                    <p className="mt-1.5 font-sans text-[0.75rem] leading-relaxed text-charcoal/50">
                      Write freely, in your own words. The prompts below are guidance, not
                      requirements.
                    </p>
                  </div>
                  <SaveStatus
                    state={saveState}
                    lastSavedAt={lastSavedAt}
                    onRetry={() => void persist()}
                    className="pt-1"
                  />
                </div>

                <label htmlFor="study-understanding" className="sr-only">
                  What this passage means to me
                </label>
                <textarea
                  id="study-understanding"
                  value={values.understanding}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, understanding: event.target.value }))
                  }
                  placeholder="In my own words, this passage is saying…"
                  className="writing-area journal-rule mt-4 min-h-[220px]"
                />

                <div className="mt-6 space-y-2">
                  <p className="font-sans text-[0.62rem] uppercase tracking-[0.18em] text-charcoal/40">
                    Optional prompts
                  </p>
                  {PROMPTS.map((prompt) => {
                    const isOpen = openPrompts.has(prompt.key);
                    return (
                      <div
                        key={prompt.key}
                        className="overflow-hidden rounded-journal border border-sage/35 bg-soft-white/60"
                      >
                        <button
                          type="button"
                          onClick={() => togglePrompt(prompt.key)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-cream/40"
                        >
                          <span>
                            <span className="block font-sans text-[0.82rem] font-medium text-charcoal/85">
                              {prompt.label}
                            </span>
                            <span className="mt-0.5 block font-sans text-[0.7rem] leading-relaxed text-charcoal/45">
                              {prompt.hint}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {values[prompt.key].trim().length > 0 ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-label="Has writing" />
                            ) : null}
                            <ChevronDown
                              size={14}
                              className={cn(
                                'text-charcoal/35 transition-transform duration-300',
                                isOpen && 'rotate-180',
                              )}
                            />
                          </span>
                        </button>
                        {isOpen ? (
                          <div className="border-t border-sage/25 px-4 py-3">
                            <label htmlFor={`study-${prompt.key}`} className="sr-only">
                              {prompt.label}
                            </label>
                            <textarea
                              id={`study-${prompt.key}`}
                              value={values[prompt.key]}
                              onChange={(event) =>
                                setValues((current) => ({
                                  ...current,
                                  [prompt.key]: event.target.value,
                                }))
                              }
                              placeholder={prompt.hint}
                              className="writing-area min-h-[120px]"
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-sage/25 pt-4">
                  <SaveStatus state={saveState} lastSavedAt={lastSavedAt} onRetry={() => void persist()} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" icon={<Save size={13} />} onClick={() => void persist()}>
                      Save now
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Eye size={13} />}
                      onClick={() => setReadingMode(true)}
                    >
                      Read My Notes
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
            <Card className="p-5">
              <p className="eyebrow">Your notebooks</p>
              <div className="mt-3 space-y-1.5">
                {myAssignments.slice(0, 6).map((entry) => {
                  const entryStudy = personalStudyService.getForAssignment(user.id, entry.id);
                  const started = personalStudyService.hasWriting(entryStudy);
                  const active = entry.id === assignment.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      className={cn(
                        'flex w-full items-start justify-between gap-2 rounded-[9px] border px-3 py-2 text-left transition-colors duration-300',
                        active
                          ? 'border-forest/40 bg-cream/60'
                          : 'border-transparent hover:border-sage/40 hover:bg-cream/30',
                      )}
                    >
                      <span>
                        <span className="block font-sans text-[0.75rem] font-medium text-charcoal/80">
                          Week of {formatDayMonth(parseIsoDate(entry.weekStart))}
                        </span>
                        <span className="mt-0.5 block font-serif text-[0.8rem] italic text-forest/70">
                          {entry.passage.reference}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                          started ? 'bg-gold' : 'bg-sage/50',
                        )}
                        title={started ? 'Writing started' : 'Not started'}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 font-sans text-[0.64rem] leading-relaxed text-charcoal/40">
                Previous weeks are kept exactly as you left them. A new Monday never overwrites an
                older notebook.
              </p>
            </Card>

            <Card className="p-5" tone="cream">
              <p className="eyebrow">Private by design</p>
              <p className="mt-2 flex items-start gap-2 font-sans text-[0.74rem] leading-relaxed text-charcoal/60">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-forest/50" />
                {partner.name} cannot read this notebook, and you cannot read {partner.name}
                &rsquo;s. Access is scoped to your own signed-in identity.
              </p>
              <DivineDivider className="my-4" />
              <p className="font-sans text-[0.7rem] leading-relaxed text-charcoal/50">
                Both passages are visible together on the Sunday Study page
                {settings.privacy.shareWeeklyPassagesInStudy ? ' — as configured in Settings.' : '.'}
              </p>
            </Card>

            <Card className="p-5">
              <p className="eyebrow">Shared with {partner.name}</p>
              <p className="mt-2 font-sans text-[0.74rem] leading-relaxed text-charcoal/55">
                &ldquo;Our Shared Takeaways&rdquo; is a separate space you both choose to write in.
                Nothing from your private notebook is ever copied into it.
              </p>
              <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => setTab('shared')}>
                Open shared takeaways
              </Button>
            </Card>
          </aside>
        </div>
      ) : null}

      {tab === 'shared' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
          <Card className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Our Shared Takeaways</p>
                <h2 className="mt-2 font-serif text-[1.55rem] leading-tight text-forest">
                  What you want to carry forward together
                </h2>
                <p className="mt-1.5 max-w-reading font-sans text-[0.75rem] leading-relaxed text-charcoal/50">
                  This space is shared with {partner.name}. Only what you type here is visible to
                  both of you — never your private notebook.
                </p>
              </div>
              {sharedSavedAt ? (
                <span className="font-sans text-[0.64rem] text-charcoal/35">
                  Saved {formatTimestamp(sharedSavedAt)}
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-5">
              {(
                [
                  {
                    key: 'mainLesson',
                    label: 'Main lesson',
                    placeholder: 'What did we learn together this week?',
                  },
                  {
                    key: 'practicalCommitment',
                    label: 'Practical commitment',
                    placeholder: 'One thing we will do this week…',
                  },
                  {
                    key: 'closingPrayer',
                    label: 'Prayer or closing reflection',
                    placeholder: 'A prayer, a verse, or a line to close with…',
                  },
                ] as Array<{ key: keyof SharedFields; label: string; placeholder: string }>
              ).map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`shared-${field.key}`}
                    className="mb-1.5 block font-sans text-[0.66rem] uppercase tracking-[0.16em] text-charcoal/45"
                  >
                    {field.label}
                  </label>
                  <textarea
                    id={`shared-${field.key}`}
                    value={sharedValues[field.key]}
                    onChange={(event) =>
                      setSharedValues((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="writing-area min-h-[110px]"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sage/25 pt-4">
              <p className="font-sans text-[0.66rem] text-charcoal/40">
                Visible to {user.name} and {partner.name}.
              </p>
              <Button icon={<Save size={13} />} onClick={saveShared}>
                Save shared takeaways
              </Button>
            </div>
          </Card>

          <aside className="space-y-4">
            <Card className="p-5" tone="cream">
              <p className="eyebrow">Kept separate</p>
              <p className="mt-2 font-sans text-[0.74rem] leading-relaxed text-charcoal/60">
                Your private reflections are never merged, emailed, or published into this section.
                Sharing only ever happens because you typed it here yourself.
              </p>
            </Card>
            <Card className="p-5">
              <p className="eyebrow">This week</p>
              <p className="mt-2 font-serif text-[1rem] text-forest">
                {formatLongDate(parseIsoDate(assignment.weekStart), 'UTC')}
              </p>
              <p className="mt-1 font-sans text-[0.7rem] text-charcoal/45">
                {assignment.passage.reference} · yours
              </p>
              {partnerAssignment ? (
                <p className="mt-0.5 font-sans text-[0.7rem] text-charcoal/45">
                  {partnerAssignment.passage.reference} · {partner.name}
                </p>
              ) : null}
            </Card>
          </aside>
        </div>
      ) : null}

      {tab === 'both' ? (
        <div className="space-y-5">
          <SectionHeading
            eyebrow="Read together"
            title="Two Scriptures, side by side"
            description="Both passages are shared here. Your private notebooks are not."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <Badge tone="forest">Yours · {user.name}</Badge>
                <TranslationBadge
                  translation={assignment.passage.translation}
                  contentKind={assignment.passage.contentKind}
                />
              </div>
              <ScripturePanel
                passage={assignment.passage}
                onCopyReference={() => void copyReference(assignment.passage.reference)}
              />
            </Card>
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <Badge tone="sage">
                  <Sparkles size={10} /> {partner.name}
                </Badge>
                {partnerAssignment ? (
                  <TranslationBadge
                    translation={partnerAssignment.passage.translation}
                    contentKind={partnerAssignment.passage.contentKind}
                  />
                ) : null}
              </div>
              {partnerAssignment ? (
                <ScripturePanel
                  passage={partnerAssignment.passage}
                  onCopyReference={() => void copyReference(partnerAssignment.passage.reference)}
                />
              ) : (
                <EmptyState
                  title="Your partner's passage is not available yet."
                  description="It will appear here once the weekly selection has completed."
                />
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
