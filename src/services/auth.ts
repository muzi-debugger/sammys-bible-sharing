import { PARTNER_IDENTITIES } from '@/lib/identities';
import type { PartnerId } from '@/types';

/**
 * Preview-only authentication.
 *
 * Accounts and sessions live in localStorage and passwords are salted SHA-256
 * digests. This is deliberately honest about its limits: there is no server, so
 * this proves the *flow* (login, register, private notebooks, personalised
 * greetings) but it is not a security boundary against someone with access to
 * the browser. Swap this module for Supabase Auth (or any backend session) when
 * the real backend is connected — the UI and guards stay identical.
 */

const ACCOUNTS_KEY = 'sbs.accounts.v1';
const SESSION_KEY = 'sbs.session.v1';

export interface Account {
  id: PartnerId;
  name: string;
  email: string;
  /** Null until the invited partner sets their password. */
  passwordHash: string | null;
  salt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface Session {
  userId: PartnerId;
  email: string;
  signedInAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/** The two invited identities. Configured through env vars so the repo holds no addresses. */
export const INVITED_ACCOUNTS: Array<Pick<Account, 'id' | 'name' | 'email'>> =
  PARTNER_IDENTITIES.map(({ id, name, email }) => ({ id, name, email }));

export class AuthError extends Error {
  readonly code:
    | 'invalid-credentials'
    | 'not-invited'
    | 'already-registered'
    | 'not-registered'
    | 'weak-password';

  constructor(code: AuthError['code'], message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable; the session simply will not persist */
  }
}

export function getAccounts(): Account[] {
  const stored = readJson<Account[] | null>(ACCOUNTS_KEY, null);
  if (stored && stored.length > 0) return stored;

  const seeded: Account[] = INVITED_ACCOUNTS.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    passwordHash: null,
    salt: null,
    createdAt: new Date().toISOString(),
    lastSignInAt: null,
  }));
  writeJson(ACCOUNTS_KEY, seeded);
  return seeded;
}

function saveAccounts(accounts: Account[]) {
  writeJson(ACCOUNTS_KEY, accounts);
}

export function getSession(): Session | null {
  const session = readJson<Session | null>(SESSION_KEY, null);
  if (!session) return null;
  const account = getAccounts().find((entry) => entry.id === session.userId);
  if (!account) return null;
  return session;
}

export function isRegistered(email: string): boolean {
  const account = getAccounts().find(
    (entry) => entry.email.toLowerCase() === email.trim().toLowerCase(),
  );
  return Boolean(account?.passwordHash);
}

export function isInvited(email: string): boolean {
  const normalised = email.trim().toLowerCase();
  return getAccounts().some((entry) => entry.email.toLowerCase() === normalised);
}

export async function signIn(email: string, password: string): Promise<Session> {
  await wait(220);
  const normalised = email.trim().toLowerCase();
  const accounts = getAccounts();
  const account = accounts.find((entry) => entry.email.toLowerCase() === normalised);

  if (!account) {
    throw new AuthError('not-invited', 'That email is not part of this circle.');
  }
  if (!account.passwordHash || !account.salt) {
    throw new AuthError(
      'not-registered',
      'This invite has not been activated yet. Choose “Create account” to set your password.',
    );
  }
  const hash = await hashPassword(password, account.salt);
  if (hash !== account.passwordHash) {
    throw new AuthError('invalid-credentials', 'That password does not match this account.');
  }

  const session: Session = {
    userId: account.id,
    email: account.email,
    signedInAt: new Date().toISOString(),
  };
  saveAccounts(
    accounts.map((entry) =>
      entry.id === account.id ? { ...entry, lastSignInAt: session.signedInAt } : entry,
    ),
  );
  writeJson(SESSION_KEY, session);
  return session;
}

export async function register({ name, email, password }: RegisterInput): Promise<Session> {
  await wait(260);
  if (password.length < 8) {
    throw new AuthError('weak-password', 'Use at least 8 characters for your password.');
  }

  const normalised = email.trim().toLowerCase();
  const accounts = getAccounts();
  const account = accounts.find((entry) => entry.email.toLowerCase() === normalised);

  if (!account) {
    throw new AuthError(
      'not-invited',
      'This application is for two people. Only the two invited email addresses can create an account.',
    );
  }
  if (account.passwordHash) {
    throw new AuthError(
      'already-registered',
      'That account is already set up. Sign in with your password instead.',
    );
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const updated: Account = {
    ...account,
    name: name.trim() || account.name,
    passwordHash,
    salt,
    lastSignInAt: new Date().toISOString(),
  };

  saveAccounts(accounts.map((entry) => (entry.id === account.id ? updated : entry)));
  const session: Session = {
    userId: updated.id,
    email: updated.email,
    signedInAt: updated.lastSignInAt as string,
  };
  writeJson(SESSION_KEY, session);
  return session;
}

export function signOut() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Keeps the sign-in identity in step with the partner details in Settings. */
export function updateAccount(id: PartnerId, patch: { name?: string; email?: string }) {
  const accounts = getAccounts();
  const account = accounts.find((entry) => entry.id === id);
  if (!account) return;
  saveAccounts(
    accounts.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
  );
  const session = getSession();
  if (session?.userId === id && patch.email) {
    writeJson(SESSION_KEY, { ...session, email: patch.email });
  }
}

export function resetAccounts() {
  try {
    window.localStorage.removeItem(ACCOUNTS_KEY);
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
