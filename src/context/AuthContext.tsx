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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccounts(authService.getAccounts());
    setSession(authService.getSession());
    setReady(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await authService.signIn(email, password);
    setAccounts(authService.getAccounts());
    setSession(next);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const next = await authService.register(input);
    setAccounts(authService.getAccounts());
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setSession(null);
  }, []);

  const refreshAccounts = useCallback(() => {
    setAccounts(authService.getAccounts());
  }, []);

  const updateAccount = useCallback(
    (id: Account['id'], patch: { name?: string; email?: string }) => {
      authService.updateAccount(id, patch);
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
      signedInAccount: accounts.find((account) => account.id === session?.userId) ?? null,
      signIn,
      register,
      signOut,
      refreshAccounts,
      updateAccount,
    }),
    [ready, session, accounts, signIn, register, signOut, refreshAccounts, updateAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
