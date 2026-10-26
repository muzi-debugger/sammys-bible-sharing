import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleAlert,
  CircleCheck,
  Database,
  Globe2,
  Lock,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { isRemoteMode, remoteConfig } from '@/lib/supabase';
import { capabilities } from '@/lib/capabilities';
import { sendTestEmail } from '@/services/remote';
import type { PartnerProfile } from '@/types';
import { Badge, Button, Card, Field, SectionHeading, Toggle, inputClass } from '@/components/ui/primitives';
import { DeliveryStatus } from '@/components/DeliveryStatus';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineError } from '@/components/ui/states';
import { DivineDivider, OpenBook } from '@/components/Botanical';
import { useToast } from '@/components/ui/Toast';
import {
  formatSelectionMoment,
  formatTimestamp,
  nextSelectionDate,
  southAfricanTimeLabel,
} from '@/lib/dates';
import { settingsService } from '@/services/settings';
import { bibleProvider, isPreviewProvider, providerInfo } from '@/services/bibleProvider';

const TIMEZONES = [
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST, UTC+2)' },
  { value: 'UTC', label: 'UTC / GMT' },
  { value: 'Europe/London', label: 'London' },
];

function PartnerCard({ partner, readOnly }: { partner: PartnerProfile; readOnly: boolean }) {
  const { updateAccount } = useAuth();
  const { notify } = useToast();
  const id = partner.id;
  const [name, setName] = useState(partner.name);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(partner.name);
  }, [partner.name]);

  const save = () => {
    if (readOnly) return;
    if (!name.trim()) {
      setError('A name is required.');
      return;
    }
    settingsService.updatePartner(id, { name: name.trim() });
    updateAccount(id, { name: name.trim() });
    setError(null);
    notify(`${name.trim()}'s details saved.`);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream font-serif text-[0.95rem] text-forest">
          {(name.trim().charAt(0) || '?').toUpperCase()}
        </span>
        <div>
          <p className="font-sans text-[0.8rem] font-medium text-charcoal">{name || 'Unnamed partner'}</p>
          <p className="font-sans text-[0.66rem] text-charcoal/40">Weekly recipient</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Name" htmlFor={`partner-name-${id}`}>
          <input
            id={`partner-name-${id}`}
            className={inputClass}
            value={name}
            disabled={readOnly}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </div>

      {error ? <p className="mt-2 font-sans text-[0.72rem] text-terracotta">{error}</p> : null}

      {readOnly ? (
        <p className="mt-4 flex items-start gap-2 font-sans text-[0.68rem] leading-relaxed text-charcoal/40">
          <Lock size={11} className="mt-[3px] shrink-0 text-forest/40" />
          Only they can change their own name and address.
        </p>
      ) : (
        <Button variant="secondary" size="sm" className="mt-4" onClick={save}>
          Save details
        </Button>
      )}
    </Card>
  );
}

export function SettingsPage() {
  const { settings, db, cycle, user, partner } = useApp();
  const { signedInAccount, signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const providerConnected = providerInfo.mode === 'connected';

  const lastAssignment = db.assignments
    .slice()
    .sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1))[0];
  const nextSelection = nextSelectionDate(new Date());

  const update = (mutator: Parameters<typeof settingsService.update>[0], message?: string) => {
    settingsService.update(mutator);
    if (message) notify(message);
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-3 font-serif text-[2rem] leading-tight text-forest sm:text-[2.4rem]">
          The shape of your week
        </h1>
        <p className="mt-2 max-w-reading font-sans text-[0.85rem] leading-relaxed text-charcoal/60">
          Recipients, schedule, the NLT preference, and who may read what.
        </p>
      </header>

      {/* Partner information */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Partner information"
          title="The two of you"
          description="Each partner receives their own passage and their own private notebook."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {settings.partners.map((profile) => (
            <PartnerCard
              key={profile.id}
              partner={profile}
              readOnly={isRemoteMode && profile.id !== user.id}
            />
          ))}
        </div>
        <p className="font-sans text-[0.68rem] leading-relaxed text-charcoal/40">
          Editing a name or address updates future deliveries only. Existing assignments keep their
          recorded recipient so delivery history stays truthful.
        </p>
      </section>

      {/* Weekly schedule */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Weekly schedule"
          title="Monday, 10:00 AM GMT"
          description="Stored in UTC and evaluated with timezone-aware scheduling logic."
        />
        <Card className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          <div className="space-y-3">
            {[
              ['Selection day', settings.schedule.day],
              ['Selection time', '10:00 AM'],
              ['Timezone', 'UTC / GMT'],
              ['South African equivalent', '12:00 PM (SAST, UTC+2)'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 border-b border-sage/20 py-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 sm:py-0 sm:pb-2">
                <span className="font-sans text-[0.72rem] uppercase tracking-[0.12em] text-charcoal/40">
                  {label}
                </span>
                <span className="text-left font-sans text-[0.8rem] text-charcoal/75 sm:text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-0.5 border-b border-sage/20 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 sm:py-0 sm:pb-2">
              <span className="font-sans text-[0.72rem] uppercase tracking-[0.12em] text-charcoal/40">
                Last selection
              </span>
              <span className="text-left font-sans text-[0.8rem] text-charcoal/75 sm:text-right">
                {cycle?.generatedAt ? formatTimestamp(cycle.generatedAt) : 'Not yet run'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-sage/20 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 sm:py-0 sm:pb-2">
              <span className="font-sans text-[0.72rem] uppercase tracking-[0.12em] text-charcoal/40">
                Next selection
              </span>
              <span className="text-left font-sans text-[0.8rem] text-charcoal/75 sm:text-right">
                {formatSelectionMoment(nextSelection)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-0">
              <span className="font-sans text-[0.72rem] uppercase tracking-[0.12em] text-charcoal/40">
                Last delivery
              </span>
              {lastAssignment ? (
                <DeliveryStatus
                  status={lastAssignment.emailDelivery.status}
                  detail={lastAssignment.emailDelivery.detail}
                />
              ) : (
                <span className="font-sans text-[0.78rem] text-charcoal/45">No deliveries yet</span>
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <DivineDivider className="mb-2" />
            <Toggle
              checked={settings.schedule.weeklyEmailEnabled}
              onChange={(next) =>
                update((draft) => {
                  draft.schedule.weeklyEmailEnabled = next;
                }, next ? 'Weekly emails enabled.' : 'Weekly emails paused.')
              }
              label="Weekly Scripture email delivery"
              description="Each Monday at 10:00 GMT, both partners receive their own passage by email."
            />
          </div>

          <div className="sm:col-span-2 -mt-2 space-y-3">
            {isRemoteMode ? (
              <>
                <p className="rounded-journal border border-sage/35 bg-cream/30 px-4 py-3 font-sans text-[0.72rem] leading-relaxed text-charcoal/55">
                  Emails are sent by the scheduled edge function (Monday 10:00 UTC and 06:00 UTC
                  daily). Delivery is only recorded once Brevo accepts the message.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={sendingTest}
                  onClick={async () => {
                    setSendingTest(true);
                    const result = await sendTestEmail();
                    setSendingTest(false);
                    notify(
                      result.ok ? 'Test email accepted by Brevo.' : `Test failed: ${result.detail}`,
                      result.ok ? 'success' : 'error',
                    );
                  }}
                >
                  {sendingTest ? 'Sending…' : 'Send a test email to myself'}
                </Button>
              </>
            ) : (
              <InlineError
                message={`Delivery is not connected in this preview build. Email attempts are logged below, but no message is sent and no “sent” status is claimed.`}
              />
            )}
          </div>

          <div className="sm:col-span-2 -mt-2">
            <InlineError
              message={
                cycle
                  ? isRemoteMode
                    ? `This week's cycle (${cycle.id}) was prepared on the server. Refreshing never replaces it.`
                    : `This week's cycle (${cycle.id}) was generated by a preview simulation of the scheduled job. Refreshing never replaces it.`
                  : 'This week has no generated assignments yet.'
              }
            />
          </div>
        </Card>
      </section>

      {/* Daily encouragement */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Daily encouragement"
          title="One verse, every morning"
          description="A motivational passage chosen from the curated prayer themes, distinct from your weekly assignment."
        />
        <Card className="p-5 sm:p-6">
          <Toggle
            checked={settings.daily.emailEnabled}
            onChange={(next) =>
              update((draft) => {
                draft.daily.emailEnabled = next;
                draft.notifications.dailyScriptureEmail = next;
              }, next ? 'Daily emails enabled.' : 'Daily emails disabled.')
            }
            label="Daily motivational Scripture email"
            description="Sent to both partners at the configured hour."
          />
          <div className="grid gap-4 border-t border-sage/20 pt-4 sm:grid-cols-2">
            <Field label="Delivery time" htmlFor="daily-hour">
              <select
                id="daily-hour"
                className={inputClass}
                value={settings.daily.hour}
                onChange={(event) =>
                  update((draft) => {
                    draft.daily.hour = Number(event.target.value);
                  })
                }
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {southAfricanTimeLabel(hour)} ({String(hour).padStart(2, '0')}:00 local)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delivery timezone" htmlFor="daily-timezone">
              <select
                id="daily-timezone"
                className={inputClass}
                value={settings.daily.timezone}
                onChange={(event) =>
                  update((draft) => {
                    draft.daily.timezone = event.target.value;
                  })
                }
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-2 border-t border-sage/20 pt-2">
            <Toggle
              checked={settings.daily.homeDisplay}
              onChange={(next) =>
                update((draft) => {
                  draft.daily.homeDisplay = next;
                })
              }
              label="Show on the home page"
              description="Display “A little encouragement for today” beneath your weekly Scriptures."
            />
          </div>
        </Card>
      </section>

      {/* Translation */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Bible translation"
          title="New Living Translation (NLT)"
          description="NLT is the application-wide default. It is a product requirement, not a decorative label."
        />
        <Card className="relative overflow-hidden p-5 sm:p-6" tone="cream">
          <OpenBook className="pointer-events-none absolute -bottom-4 right-4 h-24 w-24 text-sage/25" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/50 bg-gold/15">
                <Sparkles size={16} className="text-[#8a6f3f]" />
              </span>
              <div>
                <p className="font-serif text-[1.3rem] text-forest">New Living Translation</p>
                <p className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-charcoal/40">
                  Preferred translation · locked
                </p>
              </div>
            </div>
            <Badge tone={providerConnected ? 'forest' : 'gold'}>
              {providerConnected ? 'Provider connected' : 'Provider not connected'}
            </Badge>
          </div>

          <div className="relative mt-5 grid gap-2">
            {[
              {
                label: 'Provider offers the NLT',
                ok: providerConnected,
              },
              {
                label: 'Licence covers web display and email reproduction',
                ok: providerConnected && capabilities.nltLicensed,
              },
              {
                label: 'Caching and storage terms documented',
                ok: providerConnected && capabilities.nltLicensed,
              },
            ].map((item) => (
              <p key={item.label} className="flex items-center gap-2 font-sans text-[0.76rem] text-charcoal/60">
                {item.ok ? (
                  <CircleCheck size={13} className="text-forest" />
                ) : (
                  <CircleAlert size={13} className="text-terracotta" />
                )}
                {item.label}
              </p>
            ))}
          </div>

          <div className="relative mt-5 space-y-3">
            <Field
              label="Translation selector"
              htmlFor="translation-select"
              hint="Only translations that are both provider-supported and properly licensed may appear here."
            >
              <select id="translation-select" className={inputClass} value="NLT" disabled>
                <option value="NLT">New Living Translation (NLT)</option>
              </select>
            </Field>
            <p className="font-sans text-[0.7rem] leading-relaxed text-charcoal/55">
              No other translation is offered, and none is used as a silent fallback. Current
              provider: <strong className="font-medium">{bibleProvider.displayName}</strong>
              {isPreviewProvider
                ? ' — a preview provider that returns clearly labelled placeholder content instead of NLT text.'
                : '. Any response that is not confirmed NLT is rejected rather than substituted.'}
            </p>
            {providerConnected ? (
              <p className="rounded-[9px] border border-gold/40 bg-gold/[0.07] px-3 py-2 font-sans text-[0.68rem] leading-relaxed text-[#8a6f3f]">
                NLT access on API.Bible must be approved for your key before passages return. If a
                passage is unavailable, the app shows the error and keeps the NLT preference.
                {providerInfo.keyInFrontend
                  ? ' The API key is embedded in this build — acceptable for a private POC only; use a server-side proxy for production.'
                  : ''}
              </p>
            ) : null}
            <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/journal')}>
              See how preview passages are labelled
            </Button>
          </div>
        </Card>
      </section>

      {/* Notifications */}
      <section className="space-y-4">
        <SectionHeading eyebrow="Notifications" title="What arrives in your inbox" />
        <Card className="p-5 sm:p-6">
          <Toggle
            checked={settings.notifications.weeklyScriptureEmail}
            onChange={(next) =>
              update(
                (draft) => {
                  draft.notifications.weeklyScriptureEmail = next;
                  draft.schedule.weeklyEmailEnabled = next;
                },
                next ? 'Weekly Scripture emails on.' : 'Weekly Scripture emails off.',
              )
            }
            label="Weekly Scripture email"
            description="Monday, 10:00 GMT — your own passage, with preparation questions."
          />
          <div className="border-t border-sage/20">
            <Toggle
              checked={settings.notifications.dailyScriptureEmail}
              onChange={(next) =>
                update(
                  (draft) => {
                    draft.notifications.dailyScriptureEmail = next;
                    draft.daily.emailEnabled = next;
                  },
                  next ? 'Daily encouragement emails on.' : 'Daily encouragement emails off.',
                )
              }
              label="Daily motivational Scripture email"
              description={`Every morning at ${southAfricanTimeLabel(settings.daily.hour)}.`}
            />
          </div>
          <div className="border-t border-sage/20">
            <Toggle
              checked={settings.notifications.sundayStudyReminder}
              onChange={(next) =>
                update(
                  (draft) => {
                    draft.notifications.sundayStudyReminder = next;
                  },
                  next ? 'Sunday reminders on.' : 'Sunday reminders off.',
                )
              }
              label="Sunday study reminder"
              description="A gentle nudge on Sunday morning to open your notebook together."
            />
          </div>
        </Card>
      </section>

      {/* Privacy */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Privacy"
          title="What is shared, and what never is"
          description="Personal notebooks are private to each partner. This cannot be relaxed by a frontend setting."
        />
        <Card className="p-5 sm:p-6">
          <Toggle
            checked={settings.privacy.shareWeeklyPassagesInStudy}
            onChange={(next) =>
              update(
                (draft) => {
                  draft.privacy.shareWeeklyPassagesInStudy = next;
                },
                next ? 'Both passages are shared in the Sunday workspace.' : 'Each partner sees only their own passage.',
              )
            }
            label="Show both passages in the Sunday workspace"
            description="Passages only — never personal notes. The intended individual preparation rhythm is preserved during the week."
          />
          <div className="mt-2 rounded-journal border border-sage/30 bg-cream/30 p-4">
            <p className="flex items-start gap-2 font-sans text-[0.75rem] leading-relaxed text-charcoal/60">
              <Lock size={13} className="mt-0.5 shrink-0 text-forest/50" />
              {user.name} can read and edit {user.name}&rsquo;s own notebook. {partner.name} can read
              and edit {partner.name}&rsquo;s own notebook. Neither can reach the other&rsquo;s,
              enforced by ownership checks on every request.
            </p>
            <p className="mt-2 flex items-center gap-1.5 font-sans text-[0.66rem] uppercase tracking-[0.14em] text-charcoal/35">
              <ShieldCheck size={11} /> Owner-scoped queries · row-level security ready
            </p>
          </div>
        </Card>
      </section>

      {/* Account */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Account"
          title="Signed in as you"
          description="One account per person. Your partner's account can only be opened with their own password — there is no account switcher."
        />
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest font-serif text-[1rem] text-ivory">
                {user.initials}
              </span>
              <div>
                <p className="font-sans text-[0.85rem] font-medium text-charcoal">{user.name}</p>
                <p className="font-sans text-[0.72rem] text-charcoal/50">
                  Private notebook · row level security
                </p>
                {signedInAccount?.lastSignInAt ? (
                  <p className="mt-0.5 font-sans text-[0.64rem] text-charcoal/35">
                    Last sign-in {formatTimestamp(signedInAccount.lastSignInAt)}
                  </p>
                ) : null}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
          <p className="mt-4 border-t border-sage/25 pt-3 font-sans text-[0.68rem] leading-relaxed text-charcoal/45">
            The welcome message and every weekly email use this name and address. Changing them
            above updates both the greeting and the delivery recipient.
          </p>
        </Card>
      </section>

      {/* Stored data */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow={isRemoteMode ? 'Stored data' : 'Preview data'}
          title="What is actually stored"
          description={
            isRemoteMode
              ? 'Everything lives in your Supabase project, protected by row level security. Emails are sent by the scheduled function and only recorded once the provider accepts them.'
              : 'This build stores everything in this browser only. No backend, scheduler or email provider is connected.'
          }
        />
        <Card className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Assignments', value: db.assignments.length, icon: Globe2 },
              { label: 'Personal studies', value: db.personalStudies.length, icon: Lock },
              { label: 'Email attempts logged', value: db.emailLog.length, icon: Mail },
            ].map((stat) => (
              <div key={stat.label} className="rounded-journal border border-sage/30 bg-cream/25 p-4">
                <stat.icon size={14} className="text-forest/50" />
                <p className="mt-2 font-serif text-[1.4rem] text-forest">{stat.value}</p>
                <p className="font-sans text-[0.66rem] uppercase tracking-[0.14em] text-charcoal/40">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {db.emailLog.length > 0 ? (
            <div className="mt-5 space-y-2">
              <p className="eyebrow">Recent email attempts</p>
              {db.emailLog.slice(0, 5).map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-sage/30 px-3 py-2"
                >
                  <span className="font-sans text-[0.74rem] text-charcoal/70">
                    {attempt.kind} → {attempt.recipient}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-sans text-[0.64rem] text-charcoal/35">
                      {formatTimestamp(attempt.createdAt)}
                    </span>
                    <DeliveryStatus status={attempt.status} showLabel />
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sage/25 pt-4">
            <p className="flex items-center gap-2 font-sans text-[0.7rem] text-charcoal/45">
              <Database size={12} className="text-forest/40" />
              {isRemoteMode ? (
                <>Stored in Supabase Postgres · <code className="font-mono text-[0.68rem]">{remoteConfig.url.replace(/^https?:\/\//, '')}</code></>
              ) : (
                <>Stored in localStorage under <code className="font-mono text-[0.68rem]">sbs.preview.database.v1</code></>
              )}
            </p>
            {isRemoteMode ? null : (
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCcw size={13} />}
                onClick={() => setConfirmReset(true)}
              >
                Reset preview data
              </Button>
            )}
          </div>
        </Card>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all preview data?"
        description="This clears your local assignments, notebook entries, bookmarks and reflections, then rebuilds the sample data. It cannot be undone."
        confirmLabel="Reset everything"
        onConfirm={() => {
          settingsService.resetPreviewData();
          setConfirmReset(false);
          notify('Preview data reset.', 'info');
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
