import { DEFAULT_SETTINGS, PROFILE_SAM, PROFILE_SAMMY } from '@/data/seed';
import { PARTNER_IDENTITIES, type PartnerIdentity } from '@/lib/identities';
import { isRemoteMode, supabase } from '@/lib/supabase';
import { parseReference } from '@/data/references';
import type {
  BookmarkRecord,
  DailyScriptureRecord,
  DeliveryStatus,
  PartnerProfile,
  PassageContentKind,
  PersonalStudy,
  PreviewDatabase,
  ReflectionRecord,
  SharedTakeaway,
  WeeklyAssignment,
  WeeklyCycle,
} from '@/types';

/**
 * Supabase data access.
 *
 * Reads produce the exact `PreviewDatabase` shape the rest of the app already
 * uses, so the UI and service layer stay unchanged. Writes are thin upserts;
 * authorisation is enforced by the RLS policies in `supabase/schema.sql`
 * (private notebooks are `auth.uid() = user_id`).
 */

interface ProfileRow {
  id: string;
  household_id: string;
  display_name: string;
  slot: 'sam' | 'sammy';
}

interface CycleRow {
  id: string;
  week_start: string;
  selection_at: string;
  generated_at: string | null;
  origin: 'scheduled' | 'preview-simulation';
}

interface AssignmentRow {
  id: string;
  cycle_id: string;
  user_id: string;
  reference: string;
  translation: 'NLT';
  passage_text: string;
  attribution: string;
  provider_id: string;
  content_kind: PassageContentKind;
  theme: string;
  email_status: DeliveryStatus;
  email_recipient: string;
  email_detail: string | null;
  assigned_at: string;
}

interface DailyRow {
  day: string;
  reference: string;
  translation: 'NLT';
  passage_text: string;
  attribution: string;
  provider_id: string;
  content_kind: PassageContentKind;
  theme: string;
  selected_at: string;
}

interface StudyRow {
  id: string;
  user_id: string;
  weekly_assignment_id: string;
  cycle_id: string;
  scripture_reference: string;
  translation: 'NLT';
  understanding: string;
  observations: string;
  lessons_learned: string;
  questions: string;
  application: string;
  sunday_discussion_points: string;
  created_at: string;
  updated_at: string;
}

interface SharedRow {
  cycle_id: string;
  main_lesson: string;
  practical_commitment: string;
  closing_prayer: string;
  updated_by: string | null;
  updated_at: string;
}

interface BookmarkRow {
  id: string;
  user_id: string;
  reference: string;
  translation: 'NLT';
  passage_text: string;
  note: string;
  created_at: string;
}

interface ReflectionRow {
  id: string;
  user_id: string;
  reference: string;
  translation: 'NLT';
  body: string;
  created_at: string;
  updated_at: string;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : ''}`.toUpperCase();
}

function mapProfile(row: ProfileRow): PartnerProfile {
  return {
    id: row.id,
    name: row.display_name,
    // Addresses are intentionally not selected: one partner has no business
    // reading the other's address from the browser.
    email: '',
    initials: initialsFor(row.display_name),
  };
}

function pendingProfile(slot: PartnerIdentity): PartnerProfile {
  return {
    id: `pending-${slot.id}`,
    name: slot.name,
    // The partner has not registered yet, so their address is genuinely unknown
    // to the browser — and it is never fetched just to fill a placeholder.
    email: '',
    initials: slot.initials,
  };
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured in this build.');
  return supabase;
}

function fail(context: string, error: { message: string } | null) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** One round trip each; small data set, so loading everything is fine. */
export async function loadSnapshot(userId: string): Promise<PreviewDatabase> {
  const db = client();

  const [profilesRes, cyclesRes, assignmentsRes, dailyRes, studiesRes, sharedRes, bookmarksRes, reflectionsRes] =
    await Promise.all([
      db.from('profiles').select('id, household_id, display_name, slot'),
      db.from('weekly_cycles').select('*').order('week_start', { ascending: true }),
      db.from('weekly_assignments').select('*'),
      db.from('daily_scriptures').select('*').order('day', { ascending: true }),
      db.from('personal_studies').select('*'),
      db.from('shared_takeaways').select('*'),
      db.from('bookmarks').select('*'),
      db.from('reflections').select('*'),
    ]);

  fail('Could not load profiles', profilesRes.error);
  fail('Could not load weekly cycles', cyclesRes.error);
  fail('Could not load assignments', assignmentsRes.error);
  fail('Could not load daily scriptures', dailyRes.error);
  fail('Could not load your notebook', studiesRes.error);
  fail('Could not load shared takeaways', sharedRes.error);
  fail('Could not load bookmarks', bookmarksRes.error);
  fail('Could not load reflections', reflectionsRes.error);

  const profiles = (profilesRes.data as ProfileRow[] | null) ?? [];
  const cycles = (cyclesRes.data as CycleRow[] | null) ?? [];
  const assignmentRows = (assignmentsRes.data as AssignmentRow[] | null) ?? [];
  const dailyRows = (dailyRes.data as DailyRow[] | null) ?? [];
  const studyRows = (studiesRes.data as StudyRow[] | null) ?? [];
  const sharedRows = (sharedRes.data as SharedRow[] | null) ?? [];
  const bookmarkRows = (bookmarksRes.data as BookmarkRow[] | null) ?? [];
  const reflectionRows = (reflectionsRes.data as ReflectionRow[] | null) ?? [];

  const appProfiles = profiles.map(mapProfile);
  // The partner may not have registered yet; keep the UI intact until they do.
  if (appProfiles.length < 2) {
    const takenSlot = profiles[0]?.slot;
    const other = PARTNER_IDENTITIES.find((identity) => identity.id !== takenSlot);
    if (other) appProfiles.push(pendingProfile(other));
  }

  const assignmentWeekStart = new Map(cycles.map((cycle) => [cycle.id, cycle.week_start]));

  const assignments: WeeklyAssignment[] = assignmentRows.map((row) => {
    const parsed = parseReference(row.reference);
    return {
      id: row.id,
      cycleId: row.cycle_id,
      weekStart: assignmentWeekStart.get(row.cycle_id) ?? row.assigned_at.slice(0, 10),
      partnerId: row.user_id,
      assignedAt: row.assigned_at,
      origin: 'scheduled',
      theme: row.theme,
      emailDelivery: {
        status: row.email_status,
        recipient: row.email_recipient,
        attemptedAt: row.assigned_at,
        detail: row.email_detail ?? '',
      },
      passage: {
        reference: row.reference,
        book: parsed.book,
        chapter: parsed.chapter,
        verseStart: parsed.verseStart,
        verseEnd: parsed.verseEnd,
        translation: 'NLT',
        text: row.passage_text,
        attribution: row.attribution,
        providerId: row.provider_id,
        providerName: row.provider_id,
        retrievedAt: row.assigned_at,
        contentKind: row.content_kind,
        theme: row.theme,
        focus: '',
      },
    };
  });

  const appCycles: WeeklyCycle[] = cycles.map((row) => ({
    id: row.id,
    weekStart: row.week_start,
    selectionDate: row.selection_at,
    generatedAt: row.generated_at,
    assignmentIds: assignments.filter((a) => a.cycleId === row.id).map((a) => a.id),
    origin: row.origin,
    usedReferences: assignments.filter((a) => a.cycleId === row.id).map((a) => a.passage.reference),
  }));

  const dailyScriptures: DailyScriptureRecord[] = dailyRows.map((row) => {
    const parsed = parseReference(row.reference);
    return {
      date: row.day,
      theme: row.theme,
      selectedAt: row.selected_at,
      passage: {
        reference: row.reference,
        book: parsed.book,
        chapter: parsed.chapter,
        verseStart: parsed.verseStart,
        verseEnd: parsed.verseEnd,
        translation: 'NLT',
        text: row.passage_text,
        attribution: row.attribution,
        providerId: row.provider_id,
        providerName: row.provider_id,
        retrievedAt: row.selected_at,
        contentKind: row.content_kind,
        theme: row.theme,
        focus: '',
      },
    };
  });

  const personalStudies: PersonalStudy[] = studyRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    weeklyAssignmentId: row.weekly_assignment_id,
    cycleId: row.cycle_id,
    scriptureReference: row.scripture_reference,
    translation: 'NLT',
    understanding: row.understanding,
    observations: row.observations,
    lessonsLearned: row.lessons_learned,
    questions: row.questions,
    application: row.application,
    sundayDiscussionPoints: row.sunday_discussion_points,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSample: false,
  }));

  const sharedTakeaways: SharedTakeaway[] = sharedRows.map((row) => ({
    id: `st_${row.cycle_id}`,
    cycleId: row.cycle_id,
    mainLesson: row.main_lesson,
    practicalCommitment: row.practical_commitment,
    closingPrayer: row.closing_prayer,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));

  const bookmarks: BookmarkRecord[] = bookmarkRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    reference: row.reference,
    translation: 'NLT',
    text: row.passage_text,
    contentKind: 'placeholder',
    note: row.note,
    createdAt: row.created_at,
  }));

  const reflections: ReflectionRecord[] = reflectionRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    reference: row.reference,
    translation: 'NLT',
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSample: false,
  }));

  const partners =
    appProfiles.length >= 2 ? appProfiles : [PROFILE_SAM, PROFILE_SAMMY];

  return {
    version: 1,
    sessionUserId: userId,
    settings: {
      ...DEFAULT_SETTINGS,
      partners,
      translation: {
        ...DEFAULT_SETTINGS.translation,
        licensedProviderVerified: false,
      },
    },
    profiles: appProfiles,
    cycles: appCycles,
    assignments,
    dailyScriptures,
    personalStudies,
    sharedTakeaways,
    bookmarks,
    reflections,
    emailLog: [],
    selectionHistory: assignments.map((a) => a.passage.reference),
    seededAt: new Date().toISOString(),
    seeded: false,
  };
}

/** Creates this week's cycle + two distinct assignments if they are missing. */
export async function ensureRemoteWeek(): Promise<void> {
  const { error } = await client().rpc('ensure_current_week');
  fail('Could not prepare this week', error);
}

/** Asks the edge function to upgrade placeholder rows to licensed NLT text. */
export async function prepareScriptures(): Promise<void> {
  const { data, error } = await client().functions.invoke('send-email', {
    body: { mode: 'prepare' },
  });
  if (error) {
    console.warn('prepare-scriptures:', error.message);
    return;
  }
  const result = data as { upgraded?: number; dailyUpgraded?: boolean; nltAvailable?: boolean } | null;
  if (result && result.nltAvailable === false) {
    console.warn('NLT provider key is not configured for the email function.');
  }
}

/** Creates today's daily encouragement if it is missing. */
export async function ensureRemoteDaily(): Promise<void> {
  const { error } = await client().rpc('ensure_today_daily');
  // The function may not be installed yet; not fatal for the app.
  if (error) console.warn('ensure_today_daily:', error.message);
}

/** Sends a test email to the signed-in user through the edge function. */
export async function sendTestEmail(): Promise<{ ok: boolean; detail: string }> {
  const { data, error } = await client().functions.invoke('send-email', {
    body: { mode: 'test' },
  });
  if (error) return { ok: false, detail: error.message };
  const sent = (data as { sent?: { ok?: boolean; detail?: string } } | null)?.sent;
  return { ok: Boolean(sent?.ok), detail: sent?.detail ?? 'No detail returned' };
}

export async function upsertStudy(study: PersonalStudy): Promise<void> {
  const { error } = await client()
    .from('personal_studies')
    .upsert(
      {
        id: study.id,
        user_id: study.userId,
        weekly_assignment_id: study.weeklyAssignmentId,
        cycle_id: study.cycleId,
        scripture_reference: study.scriptureReference,
        translation: study.translation,
        understanding: study.understanding,
        observations: study.observations,
        lessons_learned: study.lessonsLearned,
        questions: study.questions,
        application: study.application,
        sunday_discussion_points: study.sundayDiscussionPoints,
      },
      { onConflict: 'id' },
    );
  fail('Could not save your notebook', error);
}

export async function upsertSharedTakeaway(takeaway: SharedTakeaway): Promise<void> {
  const { error } = await client()
    .from('shared_takeaways')
    .upsert(
      {
        cycle_id: takeaway.cycleId,
        main_lesson: takeaway.mainLesson,
        practical_commitment: takeaway.practicalCommitment,
        closing_prayer: takeaway.closingPrayer,
        updated_by: takeaway.updatedBy,
      },
      { onConflict: 'cycle_id' },
    );
  fail('Could not save the shared takeaways', error);
}

export async function insertBookmark(bookmark: BookmarkRecord): Promise<void> {
  const { error } = await client().from('bookmarks').insert({
    id: bookmark.id,
    user_id: bookmark.userId,
    reference: bookmark.reference,
    translation: bookmark.translation,
    passage_text: bookmark.text,
    note: bookmark.note,
  });
  fail('Could not save the bookmark', error);
}

export async function updateBookmarkNote(id: string, note: string): Promise<void> {
  const { error } = await client().from('bookmarks').update({ note }).eq('id', id);
  fail('Could not update the bookmark', error);
}

export async function deleteBookmark(id: string): Promise<void> {
  const { error } = await client().from('bookmarks').delete().eq('id', id);
  fail('Could not remove the bookmark', error);
}

export async function upsertReflection(reflection: ReflectionRecord): Promise<void> {
  const { error } = await client()
    .from('reflections')
    .upsert(
      {
        id: reflection.id,
        user_id: reflection.userId,
        reference: reflection.reference,
        translation: reflection.translation,
        body: reflection.body,
      },
      { onConflict: 'user_id,reference' },
    );
  fail('Could not save the reflection', error);
}

export async function updateOwnProfile(
  id: string,
  patch: { display_name?: string; email?: string },
): Promise<void> {
  const { error } = await client().from('profiles').update(patch).eq('id', id);
  fail('Could not update your details', error);
}

export const remote = {
  enabled: isRemoteMode,
  loadSnapshot,
  ensureRemoteWeek,
  upsertStudy,
  upsertSharedTakeaway,
  insertBookmark,
  updateBookmarkNote,
  deleteBookmark,
  upsertReflection,
  updateOwnProfile,
};
