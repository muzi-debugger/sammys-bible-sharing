import { getDatabase, mutateDatabase } from '@/services/storage';
import type {
  PersonalStudy,
  PreviewDatabase,
  SharedTakeaway,
  WeeklyAssignment,
  PartnerId,
} from '@/types';

export class OwnershipError extends Error {
  constructor(message = 'You do not have access to this study notebook.') {
    super(message);
    this.name = 'OwnershipError';
  }
}

export type StudyFields = Pick<
  PersonalStudy,
  | 'understanding'
  | 'observations'
  | 'lessonsLearned'
  | 'questions'
  | 'application'
  | 'sundayDiscussionPoints'
>;

export type SharedFields = Pick<SharedTakeaway, 'mainLesson' | 'practicalCommitment' | 'closingPrayer'>;

export interface PersonalStudyService {
  listForUser(userId: PartnerId): PersonalStudy[];
  getForUser(userId: PartnerId, studyId: string): PersonalStudy | undefined;
  getForAssignment(userId: PartnerId, assignmentId: string): PersonalStudy | undefined;
  ensureForAssignment(userId: PartnerId, assignment: WeeklyAssignment): PersonalStudy;
  save(userId: PartnerId, studyId: string, patch: Partial<StudyFields>): PersonalStudy;
  search(userId: PartnerId, query: string): PersonalStudy[];
  getSharedTakeaway(cycleId: string): SharedTakeaway | undefined;
  saveSharedTakeaway(userId: PartnerId, cycleId: string, patch: Partial<SharedFields>): SharedTakeaway;
  hasWriting(study: PersonalStudy | undefined): boolean;
}

function emptyStudy(userId: PartnerId, assignment: WeeklyAssignment): PersonalStudy {
  const now = new Date().toISOString();
  return {
    id: `ps_${assignment.id}`,
    userId,
    weeklyAssignmentId: assignment.id,
    cycleId: assignment.cycleId,
    scriptureReference: assignment.passage.reference,
    translation: 'NLT',
    understanding: '',
    observations: '',
    lessonsLearned: '',
    questions: '',
    application: '',
    sundayDiscussionPoints: '',
    createdAt: now,
    updatedAt: now,
    isSample: false,
  };
}

function assertOwnership(study: PersonalStudy | undefined, userId: PartnerId): PersonalStudy {
  if (!study) throw new OwnershipError('That study notebook could not be found.');
  if (study.userId !== userId) throw new OwnershipError();
  return study;
}

/**
 * Preview implementation of the private notebook service.
 *
 * Every read and write is scoped by `userId`, mirroring a Supabase Row Level
 * Security policy (`auth.uid() = user_id`). A caller can never reach another
 * partner's notes through this API, which is what the SQL policy in
 * `supabase/schema.sql` enforces once the real backend is connected.
 */
export const personalStudyService: PersonalStudyService = {
  listForUser(userId, db: PreviewDatabase = getDatabase()) {
    return db.personalStudies
      .filter((study) => study.userId === userId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  getForUser(userId, studyId) {
    const study = getDatabase().personalStudies.find((entry) => entry.id === studyId);
    return study && study.userId === userId ? study : undefined;
  },

  getForAssignment(userId, assignmentId) {
    const study = getDatabase().personalStudies.find(
      (entry) => entry.weeklyAssignmentId === assignmentId,
    );
    return study && study.userId === userId ? study : undefined;
  },

  ensureForAssignment(userId, assignment) {
    if (assignment.partnerId !== userId) {
      throw new OwnershipError('Weekly assignments can only be opened by their own reader.');
    }
    const existing = personalStudyService.getForAssignment(userId, assignment.id);
    if (existing) return existing;

    const created = emptyStudy(userId, assignment);
    mutateDatabase((draft) => {
      const already = draft.personalStudies.find(
        (entry) => entry.weeklyAssignmentId === assignment.id && entry.userId === userId,
      );
      if (!already) draft.personalStudies.push(created);
    });
    return (
      getDatabase().personalStudies.find((entry) => entry.id === created.id) ?? created
    );
  },

  save(userId, studyId, patch) {
    const study = assertOwnership(
      getDatabase().personalStudies.find((entry) => entry.id === studyId),
      userId,
    );

    let updated: PersonalStudy = study;
    mutateDatabase((draft) => {
      const target = draft.personalStudies.find((entry) => entry.id === studyId);
      if (!target) throw new OwnershipError('That study notebook could not be found.');
      if (target.userId !== userId) throw new OwnershipError();
      Object.assign(target, patch);
      target.updatedAt = new Date().toISOString();
      target.isSample = false;
      updated = { ...target };
    });
    return updated;
  },

  search(userId, query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return personalStudyService.listForUser(userId);
    return personalStudyService
      .listForUser(userId)
      .filter((study) =>
        [
          study.scriptureReference,
          study.understanding,
          study.observations,
          study.lessonsLearned,
          study.questions,
          study.application,
          study.sundayDiscussionPoints,
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
  },

  getSharedTakeaway(cycleId) {
    return getDatabase().sharedTakeaways.find((entry) => entry.cycleId === cycleId);
  },

  saveSharedTakeaway(userId, cycleId, patch) {
    const now = new Date().toISOString();
    let result: SharedTakeaway | undefined;
    mutateDatabase((draft) => {
      const existing = draft.sharedTakeaways.find((entry) => entry.cycleId === cycleId);
      if (existing) {
        Object.assign(existing, patch, { updatedAt: now, updatedBy: userId });
        result = { ...existing };
        return;
      }
      const created: SharedTakeaway = {
        id: `st_${cycleId}`,
        cycleId,
        mainLesson: '',
        practicalCommitment: '',
        closingPrayer: '',
        ...patch,
        updatedAt: now,
        updatedBy: userId,
      };
      draft.sharedTakeaways.push(created);
      result = created;
    });
    if (!result) throw new Error('Unable to save the shared takeaway.');
    return result;
  },

  hasWriting(study) {
    if (!study) return false;
    return Object.entries(study)
      .filter(([key]) =>
        [
          'understanding',
          'observations',
          'lessonsLearned',
          'questions',
          'application',
          'sundayDiscussionPoints',
        ].includes(key),
      )
      .some(([, value]) => typeof value === 'string' && value.trim().length > 0);
  },
};
