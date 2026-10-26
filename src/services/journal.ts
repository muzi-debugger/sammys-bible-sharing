import { personalStudyService } from '@/services/personalStudy';
import { getDatabase, mutateDatabase } from '@/services/storage';
import type {
  BookmarkRecord,
  JournalEntry,
  JournalEntryType,
  PartnerId,
  PassageContentKind,
  ReflectionRecord,
  ScripturePassage,
} from '@/types';

export interface JournalFilter {
  search: string;
  types: JournalEntryType[];
  cycleId?: string;
}

export interface JournalService {
  listForUser(userId: PartnerId, filter?: Partial<JournalFilter>): JournalEntry[];
  isBookmarked(userId: PartnerId, reference: string): boolean;
  getBookmark(userId: PartnerId, reference: string): BookmarkRecord | undefined;
  saveBookmark(userId: PartnerId, passage: ScripturePassage, note?: string): BookmarkRecord;
  updateBookmarkNote(userId: PartnerId, bookmarkId: string, note: string): void;
  removeBookmark(userId: PartnerId, bookmarkId: string): void;
  saveReflection(
    userId: PartnerId,
    reference: string,
    body: string,
    translation?: 'NLT',
  ): ReflectionRecord;
}

function studyBody(userId: PartnerId, assignmentId: string): { body: string; isSample: boolean } {
  const study = personalStudyService.getForAssignment(userId, assignmentId);
  if (!study) return { body: '', isSample: false };
  const body = [
    study.understanding,
    study.observations,
    study.lessonsLearned,
    study.questions,
    study.application,
    study.sundayDiscussionPoints,
  ]
    .filter((section) => section.trim().length > 0)
    .join('\n\n');
  return { body, isSample: study.isSample };
}

export const journalService: JournalService = {
  listForUser(userId, filter) {
    const db = getDatabase();
    const entries: JournalEntry[] = [];

    for (const assignment of db.assignments) {
      if (assignment.partnerId !== userId) continue;
      if (filter?.cycleId && assignment.cycleId !== filter.cycleId) continue;
      const study = studyBody(userId, assignment.id);
      entries.push({
        id: `journal_weekly_${assignment.id}`,
        type: 'weekly',
        reference: assignment.passage.reference,
        translation: 'NLT',
        body: study.body || assignment.passage.text,
        note: assignment.theme,
        date: assignment.weekStart,
        theme: assignment.theme,
        isSample: study.body.length > 0 ? study.isSample : false,
        cycleId: assignment.cycleId,
      });
    }

    for (const daily of db.dailyScriptures) {
      entries.push({
        id: `journal_daily_${daily.date}`,
        type: 'daily',
        reference: daily.passage.reference,
        translation: 'NLT',
        body: daily.passage.text,
        note: daily.theme,
        date: daily.date,
        theme: daily.theme,
        isSample: true,
      });
    }

    for (const bookmark of db.bookmarks) {
      if (bookmark.userId !== userId) continue;
      entries.push({
        id: `journal_bookmark_${bookmark.id}`,
        type: 'bookmark',
        reference: bookmark.reference,
        translation: 'NLT',
        body: bookmark.text,
        note: bookmark.note,
        date: bookmark.createdAt.slice(0, 10),
        isSample: false,
      });
    }

    for (const reflection of db.reflections) {
      if (reflection.userId !== userId) continue;
      entries.push({
        id: `journal_reflection_${reflection.id}`,
        type: 'reflection',
        reference: reflection.reference,
        translation: 'NLT',
        body: reflection.body,
        note: '',
        date: reflection.createdAt.slice(0, 10),
        isSample: Boolean(reflection.isSample),
      });
    }

    const types = filter?.types && filter.types.length > 0 ? new Set(filter.types) : null;
    const needle = (filter?.search ?? '').trim().toLowerCase();

    return entries
      .filter((entry) => (types ? types.has(entry.type) : true))
      .filter((entry) =>
        needle
          ? [entry.reference, entry.note, entry.body, entry.theme ?? '']
              .join(' ')
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  isBookmarked(userId, reference) {
    return getDatabase().bookmarks.some(
      (bookmark) => bookmark.userId === userId && bookmark.reference === reference,
    );
  },

  getBookmark(userId, reference) {
    return getDatabase().bookmarks.find(
      (bookmark) => bookmark.userId === userId && bookmark.reference === reference,
    );
  },

  saveBookmark(userId, passage, note = '') {
    const existing = journalService.getBookmark(userId, passage.reference);
    if (existing) return existing;
    const bookmark: BookmarkRecord = {
      id: `bm_${crypto.randomUUID()}`,
      userId,
      reference: passage.reference,
      translation: passage.translation,
      text: passage.text,
      contentKind: passage.contentKind as PassageContentKind,
      note,
      createdAt: new Date().toISOString(),
    };
    mutateDatabase((draft) => {
      draft.bookmarks.push(bookmark);
    });
    return bookmark;
  },

  updateBookmarkNote(userId, bookmarkId, note) {
    mutateDatabase((draft) => {
      const target = draft.bookmarks.find((entry) => entry.id === bookmarkId);
      if (!target || target.userId !== userId) return;
      target.note = note;
    });
  },

  removeBookmark(userId, bookmarkId) {
    mutateDatabase((draft) => {
      draft.bookmarks = draft.bookmarks.filter(
        (entry) => !(entry.id === bookmarkId && entry.userId === userId),
      );
    });
  },

  saveReflection(userId, reference, body) {
    const now = new Date().toISOString();
    const existing = getDatabase().reflections.find(
      (entry) => entry.userId === userId && entry.reference === reference,
    );
    if (existing) {
      mutateDatabase((draft) => {
        const target = draft.reflections.find((entry) => entry.id === existing.id);
        if (target && target.userId === userId) {
          target.body = body;
          target.updatedAt = now;
          target.isSample = false;
        }
      });
      return { ...existing, body, updatedAt: now, isSample: false };
    }
    const reflection: ReflectionRecord = {
      id: `rf_${crypto.randomUUID()}`,
      userId,
      reference,
      translation: 'NLT',
      body,
      createdAt: now,
      updatedAt: now,
      isSample: false,
    };
    mutateDatabase((draft) => {
      draft.reflections.push(reflection);
    });
    return reflection;
  },
};
