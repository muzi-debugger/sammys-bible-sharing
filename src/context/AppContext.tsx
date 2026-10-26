import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { cycleIdFor, startOfWeekUtc, toIsoDate } from '@/lib/dates';
import { useAuth } from '@/context/AuthContext';
import { isRemoteMode } from '@/lib/supabase';
import { dailyScriptureService } from '@/services/dailyScripture';
import { scriptureAssignmentService } from '@/services/scriptureAssignment';
import { ensureRemoteDaily, ensureRemoteWeek, loadSnapshot } from '@/services/remote';
import { getDatabase, hydrateDatabase, subscribeToDatabase } from '@/services/storage';
import { LoadingState } from '@/components/ui/states';
import type {
  AppSettings,
  DailyScriptureRecord,
  PartnerProfile,
  PreviewDatabase,
  WeeklyAssignment,
  WeeklyCycle,
} from '@/types';

type BootState = 'loading' | 'ready' | 'error';

interface AppContextValue {
  db: PreviewDatabase;
  user: PartnerProfile;
  partner: PartnerProfile;
  settings: AppSettings;
  cycle: WeeklyCycle | undefined;
  assignments: WeeklyAssignment[];
  myAssignment: WeeklyAssignment | undefined;
  partnerAssignment: WeeklyAssignment | undefined;
  todayDaily: DailyScriptureRecord | undefined;
  currentCycleId: string;
  bootState: BootState;
  bootError: string | null;
  retryBootstrap: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useDatabase(): PreviewDatabase {
  return useSyncExternalStore(subscribeToDatabase, getDatabase, getDatabase);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const { session } = useAuth();
  const [bootState, setBootState] = useState<BootState>('loading');
  const [bootError, setBootError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setBootState('loading');
    setBootError(null);
    try {
      if (isRemoteMode) {
        if (!session?.userId) {
          setBootState('ready');
          return;
        }
        await ensureRemoteWeek();
        await ensureRemoteDaily();
        hydrateDatabase(await loadSnapshot(session.userId));
        setBootState('ready');
        return;
      }
      const now = new Date();
      await scriptureAssignmentService.ensureCurrentCycle(now);
      await dailyScriptureService.ensureToday(now);
      setBootState('ready');
    } catch (error) {
      setBootState('error');
      setBootError(
        error instanceof Error
          ? error.message
          : 'The Scripture provider could not be reached. Your NLT preference has been kept.',
      );
    }
  }, [session?.userId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const value = useMemo<AppContextValue | null>(() => {
    const authenticatedId = session?.userId ?? db.sessionUserId;
    const user =
      db.profiles.find((profile) => profile.id === authenticatedId) ?? db.profiles[0];
    const partner =
      db.profiles.find((profile) => profile.id !== user.id) ?? db.settings.partners[1];
    if (!user || !partner) return null;

    const currentCycleId = cycleIdFor(new Date());
    const cycle =
      scriptureAssignmentService.getCycle(currentCycleId, db) ??
      scriptureAssignmentService.listCycles(db)[0];
    const assignments = cycle ? scriptureAssignmentService.getAssignments(cycle.id, db) : [];
    const todayIso = toIsoDate(new Date());
    const todayDaily =
      db.dailyScriptures.find((record) => record.date === todayIso) ??
      dailyScriptureService.listRecent(1, db)[0];

    return {
      db,
      user,
      partner,
      settings: db.settings,
      cycle,
      assignments,
      myAssignment: assignments.find((assignment) => assignment.partnerId === user.id),
      partnerAssignment: assignments.find((assignment) => assignment.partnerId === partner.id),
      todayDaily,
      currentCycleId: cycle?.id ?? currentCycleId,
      bootState,
      bootError,
      retryBootstrap: () => {
        void bootstrap();
      },
    };
  }, [db, bootState, bootError, bootstrap, session?.userId]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <LoadingState label={isRemoteMode ? 'Opening your journal' : 'Opening your devotional'} />
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}

/** Ticking clock for countdowns only, so the rest of the tree stays still. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function currentWeekMonday(now = new Date()): Date {
  return startOfWeekUtc(now);
}
