import { WEEKLY_REFERENCE_POOL, type ReferenceDefinition } from '@/data/references';
import {
  cycleIdFor,
  selectionDateFor,
  startOfWeekUtc,
  toIsoDate,
} from '@/lib/dates';
import { bibleProvider, TranslationUnavailableError, type BibleProvider } from '@/services/bibleProvider';
import { emailDeliveryService, type EmailDeliveryService } from '@/services/emailDelivery';
import { getDatabase, mutateDatabase } from '@/services/storage';
import type {
  EmailDelivery,
  PartnerId,
  PreviewDatabase,
  WeeklyAssignment,
  WeeklyCycle,
} from '@/types';

export const HISTORY_WINDOW = 10;

export interface SelectionOutcome {
  cycle: WeeklyCycle;
  created: boolean;
  assignments: WeeklyAssignment[];
}

export interface ScheduleSnapshot {
  cycleId: string;
  weekStart: string;
  selectionDate: string;
  generatedAt: string | null;
  hasAssignments: boolean;
  isCurrentWeek: boolean;
}

export class ScriptureAssignmentService {
  constructor(
    private readonly provider: BibleProvider = bibleProvider,
    private readonly email: EmailDeliveryService = emailDeliveryService,
  ) {}

  listCycles(db: PreviewDatabase = getDatabase()): WeeklyCycle[] {
    return [...db.cycles].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  }

  getCycle(cycleId: string, db: PreviewDatabase = getDatabase()): WeeklyCycle | undefined {
    return db.cycles.find((cycle) => cycle.id === cycleId);
  }

  getAssignments(cycleId: string, db: PreviewDatabase = getDatabase()): WeeklyAssignment[] {
    const cycle = this.getCycle(cycleId, db);
    if (!cycle) return [];
    return db.assignments.filter((assignment) => assignment.cycleId === cycle.id);
  }

  getAssignment(
    cycleId: string,
    partnerId: PartnerId,
    db: PreviewDatabase = getDatabase(),
  ): WeeklyAssignment | undefined {
    return this.getAssignments(cycleId, db).find((assignment) => assignment.partnerId === partnerId);
  }

  /** The cycle that owns `now`, plus whether it has been generated yet. */
  currentSnapshot(now = new Date(), db: PreviewDatabase = getDatabase()): ScheduleSnapshot {
    const cycleId = cycleIdFor(now);
    const cycle = this.getCycle(cycleId, db);
    const monday = startOfWeekUtc(now);
    return {
      cycleId,
      weekStart: toIsoDate(monday),
      selectionDate: selectionDateFor(now).toISOString(),
      generatedAt: cycle?.generatedAt ?? null,
      hasAssignments: Boolean(cycle && cycle.assignmentIds.length === 2),
      isCurrentWeek: true,
    };
  }

  /**
   * Mirrors the Monday 10:00 UTC scheduled job. In preview mode this runs once
   * on app load so the interface has stable, persisted assignments.
   */
  async ensureCurrentCycle(now = new Date()): Promise<SelectionOutcome> {
    const db = getDatabase();
    const cycleId = cycleIdFor(now);
    const existing = this.getCycle(cycleId, db);
    if (existing) {
      return { cycle: existing, created: false, assignments: this.getAssignments(existing.id, db) };
    }
    return this.runSelection(now);
  }

  /**
   * Idempotent: an existing weekly cycle is never replaced, so refreshing or
   * retrying cannot duplicate assignments or emails.
   */
  async runSelection(now = new Date()): Promise<SelectionOutcome> {
    const db = getDatabase();
    const cycleId = cycleIdFor(now);
    const existing = this.getCycle(cycleId, db);
    if (existing) {
      return { cycle: existing, created: false, assignments: this.getAssignments(existing.id, db) };
    }

    const [samPick, sammyPick] = this.pickReferences(db);
    const [samPassage, sammyPassage] = await Promise.all([
      this.provider.getPassage({ reference: samPick.reference, translation: 'NLT' }),
      this.provider.getPassage({ reference: sammyPick.reference, translation: 'NLT' }),
    ]);

    if (samPassage.translation !== 'NLT' || sammyPassage.translation !== 'NLT') {
      throw new TranslationUnavailableError('NLT', this.provider.id);
    }

    const monday = startOfWeekUtc(now);
    const weekStart = toIsoDate(monday);
    const assignedAt = new Date().toISOString();
    const selectionDate = selectionDateFor(now);

    const partners = db.settings.partners;
    const sam = partners.find((p) => p.id === 'sam');
    const sammy = partners.find((p) => p.id === 'sammy');
    if (!sam || !sammy) {
      throw new Error('Both partner profiles must be configured before a selection can run.');
    }

    const samDelivery = await this.email.deliverWeeklyScripture({
      partner: sam,
      assignment: {
        id: `wa_${cycleId}_sam`,
        cycleId,
        weekStart,
        partnerId: 'sam',
        passage: samPassage,
        assignedAt,
        origin: 'preview-simulation',
        theme: samPassage.theme,
        emailDelivery: {
          status: 'queued',
          recipient: sam.email,
          attemptedAt: assignedAt,
          detail: 'Queued for delivery.',
        },
      },
      sundayStudyUrl: '#/sunday-study',
    });
    const sammyDelivery = await this.email.deliverWeeklyScripture({
      partner: sammy,
      assignment: {
        id: `wa_${cycleId}_sammy`,
        cycleId,
        weekStart,
        partnerId: 'sammy',
        passage: sammyPassage,
        assignedAt,
        origin: 'preview-simulation',
        theme: sammyPassage.theme,
        emailDelivery: {
          status: 'queued',
          recipient: sammy.email,
          attemptedAt: assignedAt,
          detail: 'Queued for delivery.',
        },
      },
      sundayStudyUrl: '#/sunday-study',
    });

    const assignments: WeeklyAssignment[] = [
      {
        id: `wa_${cycleId}_sam`,
        cycleId,
        weekStart,
        partnerId: 'sam',
        passage: samPassage,
        assignedAt,
        origin: 'preview-simulation',
        theme: samPick.theme,
        emailDelivery: samDelivery,
      },
      {
        id: `wa_${cycleId}_sammy`,
        cycleId,
        weekStart,
        partnerId: 'sammy',
        passage: sammyPassage,
        assignedAt,
        origin: 'preview-simulation',
        theme: sammyPick.theme,
        emailDelivery: sammyDelivery,
      },
    ];

    const cycle: WeeklyCycle = {
      id: cycleId,
      weekStart,
      selectionDate: selectionDate.toISOString(),
      generatedAt: assignedAt,
      assignmentIds: assignments.map((a) => a.id),
      origin: 'preview-simulation',
      usedReferences: [samPick.reference, sammyPick.reference],
    };

    mutateDatabase((draft) => {
      if (draft.cycles.some((entry) => entry.id === cycleId)) return;
      draft.cycles.push(cycle);
      draft.assignments.push(...assignments);
      draft.selectionHistory = [
        ...draft.selectionHistory,
        samPick.reference,
        sammyPick.reference,
      ].slice(-40);
    });

    return { cycle, created: true, assignments };
  }

  /** Retries delivery for an existing assignment without creating a duplicate. */
  async retryDelivery(assignmentId: string): Promise<EmailDelivery> {
    const db = getDatabase();
    const assignment = db.assignments.find((entry) => entry.id === assignmentId);
    if (!assignment) throw new Error('Assignment not found.');
    const partner = db.settings.partners.find((p) => p.id === assignment.partnerId);
    if (!partner) throw new Error('Partner not found.');

    const delivery = await this.email.deliverWeeklyScripture({
      partner,
      assignment,
      sundayStudyUrl: '#/sunday-study',
    });

    mutateDatabase((draft) => {
      const target = draft.assignments.find((entry) => entry.id === assignmentId);
      if (target) target.emailDelivery = delivery;
    });
    return delivery;
  }

  private pickReferences(db: PreviewDatabase): [ReferenceDefinition, ReferenceDefinition] {
    const recent = new Set(db.selectionHistory.slice(-HISTORY_WINDOW));
    const available = WEEKLY_REFERENCE_POOL.filter((entry) => !recent.has(entry.reference));
    const pool = available.length >= 6 ? available : WEEKLY_REFERENCE_POOL;

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const first = shuffled[0] ?? WEEKLY_REFERENCE_POOL[0];

    // Guarantee the two assignments differ in reference, book and theme.
    const second =
      shuffled.find(
        (entry) =>
          entry.reference !== first.reference &&
          entry.theme !== first.theme &&
          entry.reference.split(' ')[0] !== first.reference.split(' ')[0],
      ) ?? shuffled.find((entry) => entry.reference !== first.reference) ?? WEEKLY_REFERENCE_POOL[1];

    return [first, second];
  }
}

export const scriptureAssignmentService = new ScriptureAssignmentService();
