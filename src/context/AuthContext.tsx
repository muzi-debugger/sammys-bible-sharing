import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authService from '@/services/auth';
import type { Account, RegisterInput, Session } from '@/services/auth';
import { isRemoteMode, supabase } from '@/lib/supabase';

interface AuthContextValue {
  ready: boolean;
  session: Session | null;
  accounts: Account[];
  signedInAccount: Account | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => void;
  refreshAccounts: () => void;
  updateAccount: (id: Account['id'], patch: { name?: string; email?: string }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function fromSupabaseUser(user: {
  id: string;
  email?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
}): { session: Session; account: Account } {
  const email = user.email ?? '';
  const name =
    (typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
    email.split('@')[0] ||
    'You';
  return {
    session: { userId: user.id, email, signedInAt: user.last_sign_in_at ?? new Date().toISOString() },
    account: {
      id: user.id,
      name,
      email,
      passwordHash: 'supabase-managed',
      salt: null,
      createdAt: user.last_sign_in_at ?? new Date().toISOString(),
      lastSignInAt: user.last_sign_in_at ?? null,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [remoteAccount, setRemoteAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isRemoteMode && supabase) {
      let active = true;
      void supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        if (data.session?.user) {
          const mapped = fromSupabaseUser(data.session.user);
          setSession(mapped.session);
          setRemoteAccount(mapped.account);
        }
        setReady(true);
      });
      const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.user) {
          const mapped = fromSupabaseUser(nextSession.user);
          setSession(mapped.session);
          setRemoteAccount(mapped.account);
        } else {
          setSession(null);
          setRemoteAccount(null);
        }
        setReady(true);
      });
      return () => {
        active = false;
        subscription.subscription.unsubscribe();
      };
    }

    setAccounts(authService.getAccounts());
    setSession(authService.getSession());
    setReady(true);
    return undefined;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await authService.signIn(email, password);
    if (!isRemoteMode) setAccounts(authService.getAccounts());
    setSession(next);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const next = await authService.register(input);
    if (!isRemoteMode) setAccounts(authService.getAccounts());
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setSession(null);
    setRemoteAccount(null);
  }, []);

  const refreshAccounts = useCallback(() => {
    if (!isRemoteMode) setAccounts(authService.getAccounts());
  }, []);

  const updateAccount = useCallback(
    (id: Account['id'], patch: { name?: string; email?: string }) => {
      authService.updateAccount(id, patch);
      if (isRemoteMode) {
        setRemoteAccount((current) =>
          current && current.id === id
            ? { ...current, name: patch.name ?? current.name, email: patch.email ?? current.email }
            : current,
        );
        return;
      }
      setAccounts(authService.getAccounts());
      setSession(authService.getSession());
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      accounts,
      signedInAccount:
        isRemoteMode
          ? remoteAccount
          : accounts.find((account) => account.id === session?.userId) ?? null,
      signIn,
      register,
      signOut,
      refreshAccounts,
      updateAccount,
    }),
    [ready, session, accounts, remoteAccount, signIn, register, signOut, refreshAccounts, updateAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
