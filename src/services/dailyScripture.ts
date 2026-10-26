import { DAILY_REFERENCE_POOL, type ReferenceDefinition } from '@/data/references';
import { addDays, toIsoDate } from '@/lib/dates';
import { bibleProvider, type BibleProvider } from '@/services/bibleProvider';
import { getDatabase, mutateDatabase } from '@/services/storage';
import type { DailyScriptureRecord, PreviewDatabase } from '@/types';

const RECENT_WINDOW_DAYS = 10;

export interface DailyOutcome {
  record: DailyScriptureRecord;
  created: boolean;
}

export class DailyScriptureService {
  constructor(private readonly provider: BibleProvider = bibleProvider) {}

  listRecent(days = 14, db: PreviewDatabase = getDatabase()): DailyScriptureRecord[] {
    return [...db.dailyScriptures]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, days);
  }

  getForDate(dateIso: string, db: PreviewDatabase = getDatabase()): DailyScriptureRecord | undefined {
    return db.dailyScriptures.find((record) => record.date === dateIso);
  }

  /** Selects and persists today's encouragement once per calendar day. */
  async ensureToday(now = new Date()): Promise<DailyOutcome> {
    const dateIso = toIsoDate(now);
    const db = getDatabase();
    const existing = this.getForDate(dateIso, db);
    if (existing) return { record: existing, created: false };

    const definition = this.pickReference(db, dateIso);
    const passage = await this.provider.getPassage({
      reference: definition.reference,
      translation: 'NLT',
    });

    const record: DailyScriptureRecord = {
      date: dateIso,
      theme: definition.theme,
      passage,
      selectedAt: new Date().toISOString(),
    };

    mutateDatabase((draft) => {
      if (draft.dailyScriptures.some((entry) => entry.date === dateIso)) return;
      draft.dailyScriptures.push(record);
    });

    return { record, created: true };
  }

  /** Switches the current day's verse (useful while previewing the design). */
  async refreshToday(now = new Date()): Promise<DailyScriptureRecord> {
    const dateIso = toIsoDate(now);
    const db = getDatabase();
    const definition = this.pickReference(db, dateIso);
    const passage = await this.provider.getPassage({
      reference: definition.reference,
      translation: 'NLT',
    });
    const record: DailyScriptureRecord = {
      date: dateIso,
      theme: definition.theme,
      passage,
      selectedAt: new Date().toISOString(),
    };
    mutateDatabase((draft) => {
      draft.dailyScriptures = draft.dailyScriptures.filter((entry) => entry.date !== dateIso);
      draft.dailyScriptures.push(record);
    });
    return record;
  }

  private pickReference(db: PreviewDatabase, dateIso: string): ReferenceDefinition {
    const cutoff = toIsoDate(addDays(new Date(`${dateIso}T00:00:00Z`), -RECENT_WINDOW_DAYS));
    const recentDaily = db.dailyScriptures
      .filter((record) => record.date >= cutoff)
      .map((record) => record.passage.reference);
    const weekly = db.assignments.map((assignment) => assignment.passage.reference);
    const excluded = new Set([...recentDaily, ...weekly]);

    const options = DAILY_REFERENCE_POOL.filter((entry) => !excluded.has(entry.reference));
    const pool = options.length > 0 ? options : DAILY_REFERENCE_POOL;
    const dayIndex = Math.floor(new Date(`${dateIso}T00:00:00Z`).getTime() / 86_400_000);
    return pool[dayIndex % pool.length];
  }
}

export const dailyScriptureService = new DailyScriptureService();
