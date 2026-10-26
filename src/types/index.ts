export type TranslationId = 'NLT';

/**
 * A partner id. In local preview mode this is 'sam' / 'sammy'; with Supabase it
 * is the profile uuid from `public.profiles`.
 */
export type PartnerId = string;

export interface PartnerProfile {
  id: PartnerId;
  /** The person's display name, e.g. "Sam". */
  name: string;
  email: string;
  /** Short label used for the private notebook, e.g. "Sam's notebook". */
  initials: string;
}

/** Where the appointment the passage belongs to originated. */
export type AssignmentOrigin = 'preview-simulation' | 'scheduled';

/**
 * `placeholder` means the text body is a preview stand-in and is NOT
 * New Living Translation text. `licensed` means it came from a verified,
 * licensed NLT provider. The UI must never render a placeholder as Scripture.
 */
export type PassageContentKind = 'placeholder' | 'licensed';

export interface ScripturePassage {
  reference: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  translation: TranslationId;
  /** Passage body. For placeholders this is an explicit preview notice, not Scripture. */
  text: string;
  attribution: string;
  providerId: string;
  providerName: string;
  retrievedAt: string;
  contentKind: PassageContentKind;
  theme: string;
  /** A 1–2 line description of what the passage covers. Never Scripture text. */
  focus: string;
}

export type DeliveryStatus =
  | 'preview'
  | 'queued'
  | 'accepted'
  | 'delivered'
  | 'bounced'
  | 'failed';

export interface EmailDelivery {
  status: DeliveryStatus;
  recipient: string;
  attemptedAt: string | null;
  detail: string;
  providerMessageId?: string;
}

export interface WeeklyAssignment {
  id: string;
  cycleId: string;
  /** ISO date (YYYY-MM-DD) of the Monday that opens the cycle. */
  weekStart: string;
  partnerId: PartnerId;
  passage: ScripturePassage;
  assignedAt: string;
  origin: AssignmentOrigin;
  emailDelivery: EmailDelivery;
  /** Devotional theme used to keep the two weekly passages distinct in feel. */
  theme: string;
}

export interface WeeklyCycle {
  id: string;
  weekStart: string;
  selectionDate: string;
  generatedAt: string | null;
  assignmentIds: string[];
  origin: AssignmentOrigin;
  /** Passages already used, to respect the selection history window. */
  usedReferences: string[];
}

export interface DailyScriptureRecord {
  /** ISO date of the day the encouragement belongs to. */
  date: string;
  theme: string;
  passage: ScripturePassage;
  selectedAt: string;
}

export interface PersonalStudy {
  id: string;
  /** Owner. Access control is enforced on this field in the service layer. */
  userId: PartnerId;
  weeklyAssignmentId: string;
  cycleId: string;
  scriptureReference: string;
  translation: TranslationId;
  understanding: string;
  observations: string;
  lessonsLearned: string;
  questions: string;
  application: string;
  sundayDiscussionPoints: string;
  createdAt: string;
  updatedAt: string;
  /** True while the entry still holds seeded sample writing. */
  isSample: boolean;
}

export interface SharedTakeaway {
  id: string;
  cycleId: string;
  mainLesson: string;
  practicalCommitment: string;
  closingPrayer: string;
  updatedAt: string;
  updatedBy: PartnerId | null;
}

export type JournalEntryType = 'weekly' | 'daily' | 'bookmark' | 'reflection';

export interface BookmarkRecord {
  id: string;
  userId: PartnerId;
  reference: string;
  translation: TranslationId;
  text: string;
  contentKind: PassageContentKind;
  note: string;
  createdAt: string;
}

export interface ReflectionRecord {
  id: string;
  userId: PartnerId;
  reference: string;
  translation: TranslationId;
  body: string;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}

export interface JournalEntry {
  id: string;
  type: JournalEntryType;
  reference: string;
  translation: TranslationId;
  /** Searchable body: notes, reflections, or the passage preview text. */
  body: string;
  note: string;
  date: string;
  theme?: string;
  isSample: boolean;
  /** Present for weekly entries so the journal can deep-link into study. */
  cycleId?: string;
}

export interface SelectionSchedule {
  day: 'Monday';
  hourUtc: number;
  minute: number;
  timezone: 'UTC';
  weeklyEmailEnabled: boolean;
}

export interface DailyPreferences {
  emailEnabled: boolean;
  /** Hour of the day in `timezone` (default 08:00 South African time). */
  hour: number;
  minute: number;
  timezone: string;
  homeDisplay: boolean;
}

export interface NotificationSettings {
  weeklyScriptureEmail: boolean;
  dailyScriptureEmail: boolean;
  sundayStudyReminder: boolean;
}

export interface AppSettings {
  partners: PartnerProfile[];
  schedule: SelectionSchedule;
  daily: DailyPreferences;
  translation: {
    preferred: TranslationId;
    /** Set true only after a licensed NLT provider is verified and configured. */
    licensedProviderVerified: boolean;
  };
  notifications: NotificationSettings;
  privacy: {
    /** Both partners may read both passages together in the Sunday workspace. */
    shareWeeklyPassagesInStudy: boolean;
  };
}

export interface EmailAttempt {
  id: string;
  kind: 'weekly' | 'daily' | 'sunday-reminder';
  recipient: string;
  subject: string;
  createdAt: string;
  status: DeliveryStatus;
  detail: string;
}

export interface PreviewDatabase {
  version: 1;
  sessionUserId: PartnerId;
  settings: AppSettings;
  profiles: PartnerProfile[];
  cycles: WeeklyCycle[];
  assignments: WeeklyAssignment[];
  dailyScriptures: DailyScriptureRecord[];
  personalStudies: PersonalStudy[];
  sharedTakeaways: SharedTakeaway[];
  bookmarks: BookmarkRecord[];
  reflections: ReflectionRecord[];
  emailLog: EmailAttempt[];
  selectionHistory: string[];
  seededAt: string;
  seeded: boolean;
}
