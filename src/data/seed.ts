import { DAILY_REFERENCE_POOL, WEEKLY_REFERENCE_POOL } from '@/data/references';
import { PARTNER_IDENTITIES } from '@/lib/identities';
import { addDays, cycleIdFor, selectionDateFor, startOfWeekUtc, toIsoDate } from '@/lib/dates';
import { makePlaceholderPassage } from '@/services/passageFactory';
import type {
  AppSettings,
  BookmarkRecord,
  DailyScriptureRecord,
  EmailDelivery,
  PartnerProfile,
  PersonalStudy,
  PreviewDatabase,
  ReflectionRecord,
  SharedTakeaway,
  WeeklyAssignment,
  WeeklyCycle,
} from '@/types';

export const PROFILE_SAM: PartnerProfile = { ...PARTNER_IDENTITIES[0] };

export const PROFILE_SAMMY: PartnerProfile = { ...PARTNER_IDENTITIES[1] };

const PROVIDER_ID = 'preview';
const PROVIDER_NAME = 'Preview provider (no licensed NLT source configured)';

export const DEFAULT_SETTINGS: AppSettings = {
  partners: [PROFILE_SAM, PROFILE_SAMMY],
  schedule: {
    day: 'Monday',
    hourUtc: 10,
    minute: 0,
    timezone: 'UTC',
    weeklyEmailEnabled: true,
  },
  daily: {
    emailEnabled: true,
    hour: 8,
    minute: 0,
    timezone: 'Africa/Johannesburg',
    homeDisplay: true,
  },
  translation: {
    preferred: 'NLT',
    licensedProviderVerified: false,
  },
  notifications: {
    weeklyScriptureEmail: true,
    dailyScriptureEmail: true,
    sundayStudyReminder: true,
  },
  privacy: {
    shareWeeklyPassagesInStudy: true,
  },
};

export const PREVIEW_DELIVERY: EmailDelivery = {
  status: 'preview',
  recipient: '',
  attemptedAt: null,
  detail:
    'Preview mode — no email was sent. The delivery service is not connected, so no “sent” status is claimed.',
};

function findReference(reference: string) {
  const found = WEEKLY_REFERENCE_POOL.find((r) => r.reference === reference);
  if (!found) throw new Error(`Unknown seed reference: ${reference}`);
  return found;
}

function buildAssignment(
  cycleId: string,
  weekStartIso: string,
  partner: PartnerProfile,
  reference: string,
  assignedAt: string,
): WeeklyAssignment {
  const definition = findReference(reference);
  return {
    id: `wa_${cycleId}_${partner.id}`,
    cycleId,
    weekStart: weekStartIso,
    partnerId: partner.id,
    passage: makePlaceholderPassage(
      definition.reference,
      definition.theme,
      definition.focus,
      PROVIDER_ID,
      PROVIDER_NAME,
      assignedAt,
    ),
    assignedAt,
    origin: 'preview-simulation',
    emailDelivery: { ...PREVIEW_DELIVERY, recipient: partner.email },
    theme: definition.theme,
  };
}

const SEED_WEEKS: Array<{ offset: number; sam: string; sammy: string }> = [
  { offset: 0, sam: 'Psalm 23:1-6', sammy: 'Colossians 3:12-14' },
  { offset: -1, sam: 'Isaiah 40:28-31', sammy: 'Proverbs 3:5-6' },
  { offset: -2, sam: 'Hebrews 11:1-3', sammy: 'James 1:2-4' },
  { offset: -3, sam: 'Psalm 100:1-5', sammy: 'Romans 15:4-6' },
];

function seedStudy(
  cycleId: string,
  assignment: WeeklyAssignment,
  fields: Partial<PersonalStudy> & { createdAt: string; updatedAt: string },
): PersonalStudy {
  return {
    id: `ps_${assignment.id}`,
    userId: assignment.partnerId,
    weeklyAssignmentId: assignment.id,
    cycleId,
    scriptureReference: assignment.passage.reference,
    translation: 'NLT',
    understanding: '',
    observations: '',
    lessonsLearned: '',
    questions: '',
    application: '',
    sundayDiscussionPoints: '',
    isSample: true,
    ...fields,
  };
}

export function buildSeedDatabase(now = new Date()): PreviewDatabase {
  const currentMonday = startOfWeekUtc(now);
  const cycles: WeeklyCycle[] = [];
  const assignments: WeeklyAssignment[] = [];
  const personalStudies: PersonalStudy[] = [];
  const usedReferences: string[] = [];

  for (const week of SEED_WEEKS) {
    const monday = addDays(currentMonday, week.offset * 7);
    const cycleId = cycleIdFor(monday);
    const weekStart = toIsoDate(monday);
    const selectionDate = selectionDateFor(monday);
    const assignedAt = new Date(
      Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 10, 0, 0),
    ).toISOString();

    const sam = buildAssignment(cycleId, weekStart, PROFILE_SAM, week.sam, assignedAt);
    const sammy = buildAssignment(cycleId, weekStart, PROFILE_SAMMY, week.sammy, assignedAt);

    cycles.push({
      id: cycleId,
      weekStart,
      selectionDate: selectionDate.toISOString(),
      generatedAt: assignedAt,
      assignmentIds: [sam.id, sammy.id],
      origin: 'preview-simulation',
      usedReferences: [week.sam, week.sammy],
    });
    assignments.push(sam, sammy);
    usedReferences.push(week.sam, week.sammy);

    if (week.offset === 0) {
      personalStudies.push(
        seedStudy(cycleId, sam, {
          understanding:
            'I keep coming back to the picture of being led rather than pushed. The shepherd does not stand at a distance giving directions — he stays close, and the path is chosen with the sheep in mind.\n\nWhat strikes me is how ordinary the details are: rest, water, a well-worn path, a table in the middle of a difficult season. Nothing dramatic. Just steady care.',
          observations:
            '• The word “rest” — rest is given, not earned.\n• “He renews my strength” — renewal follows being still.\n• The table appears while enemies are still present, not after they leave.\n\nI want to notice that the goodness being described is not the absence of trouble.',
          lessonsLearned:
            'Faith is less about knowing the whole route and more about knowing the One who walks it with me. Trust is a direction of travel rather than a feeling.',
          questions:
            'What does rest look like for us in this season?\nIs there somewhere I am trying to out-walk God instead of following him?',
          application:
            'Take fifteen quiet minutes each morning before opening my phone, and write one line about what I am carrying into the day.',
          sundayDiscussionPoints:
            'I would love to talk about what “rest” means for us as a couple — not just a slow Sunday, but an actual rhythm we choose.',
          createdAt: assignedAt,
          updatedAt: addDays(now, -1).toISOString(),
        }),
      );
    }

    if (week.offset === -1) {
      personalStudies.push(
        seedStudy(cycleId, sam, {
          understanding:
            'Waiting is described as something that renews rather than wastes. Strength is pictured as something given quietly, not summoned loudly.',
          observations: 'The contrast between the young and the weary. The weary are the ones who are promised strength.',
          lessonsLearned: 'Being tired is not a failure of faith.',
          questions: 'What am I trying to rush that needs to be waited for?',
          application: 'Name one thing we are waiting on together and pray about it each evening.',
          sundayDiscussionPoints: 'Where are we running ahead of God as a couple?',
          createdAt: assignedAt,
          updatedAt: assignedAt,
        }),
        seedStudy(cycleId, sammy, {
          understanding:
            'The passage links trust with direction. It does not promise that I will understand everything, only that the path will be made straight.',
          observations: '“All your heart” — the whole of it, not the parts that feel cooperative.',
          lessonsLearned: 'Trust is a practice, especially where I cannot see the ending.',
          questions: 'Which decision am I holding back from bringing to God?',
          application: 'Pray before deciding, not after.',
          sundayDiscussionPoints: 'What would it look like to decide something together this week, starting in prayer?',
          createdAt: assignedAt,
          updatedAt: assignedAt,
        }),
      );
    }
  }

  const dailyScriptures: DailyScriptureRecord[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(now, -i);
    const isoDay = toIsoDate(day);
    const definition = DAILY_REFERENCE_POOL[i % DAILY_REFERENCE_POOL.length];
    dailyScriptures.push({
      date: isoDay,
      theme: definition.theme,
      selectedAt: new Date(day.setUTCHours(4, 0, 0, 0)).toISOString(),
      passage: makePlaceholderPassage(
        definition.reference,
        definition.theme,
        definition.focus,
        PROVIDER_ID,
        PROVIDER_NAME,
      ),
    });
  }

  const bookmarks: BookmarkRecord[] = [
    {
      id: 'bm_seed_sam',
      userId: 'sam',
      reference: 'Philippians 4:6-7',
      translation: 'NLT',
      text: makePlaceholderPassage(
        'Philippians 4:6-7',
        'Peace',
        'prayer that steadies an anxious heart',
        PROVIDER_ID,
        PROVIDER_NAME,
      ).text,
      contentKind: 'placeholder',
      note: 'Prayer as the first response, not the last resort.',
      createdAt: addDays(now, -2).toISOString(),
    },
    {
      id: 'bm_seed_sammy',
      userId: 'sammy',
      reference: 'Psalm 34:1-8',
      translation: 'NLT',
      text: makePlaceholderPassage(
        'Psalm 34:1-8',
        'Gratitude',
        'blessing the Lord at all times',
        PROVIDER_ID,
        PROVIDER_NAME,
      ).text,
      contentKind: 'placeholder',
      note: 'For the days that start with heaviness.',
      createdAt: addDays(now, -4).toISOString(),
    },
  ];

  const reflections: ReflectionRecord[] = [
    {
      id: 'rf_seed_sam',
      userId: 'sam',
      reference: '1 Thessalonians 5:18',
      translation: 'NLT',
      body:
        'Gratitude is not pretending everything is fine. It is choosing to name what is good while the rest is still unfinished.',
      createdAt: addDays(now, -3).toISOString(),
      updatedAt: addDays(now, -3).toISOString(),
      isSample: true,
    },
  ];

  const sharedTakeaways: SharedTakeaway[] = [
    {
      id: 'st_seed_prev',
      cycleId: cycleIdFor(addDays(currentMonday, -7)),
      mainLesson: 'We both landed on the same word: steady.',
      practicalCommitment: 'Pray together before making decisions about the house, not after.',
      closingPrayer: 'Lord, keep us patient with one another this week.',
      updatedAt: addDays(now, -6).toISOString(),
      updatedBy: 'sam',
    },
  ];

  return {
    version: 1,
    sessionUserId: 'sam',
    settings: DEFAULT_SETTINGS,
    profiles: [PROFILE_SAM, PROFILE_SAMMY],
    cycles,
    assignments,
    dailyScriptures,
    personalStudies,
    sharedTakeaways,
    bookmarks,
    reflections,
    emailLog: [],
    selectionHistory: usedReferences,
    seededAt: now.toISOString(),
    seeded: true,
  };
}
