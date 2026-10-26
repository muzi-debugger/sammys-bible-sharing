import type { PartnerId } from '@/types';

/**
 * The two partner identities.
 *
 * Only display names are configurable, because a name is the only identity data
 * the browser actually needs. Email addresses are deliberately NOT read from the
 * environment here: every `VITE_*` value is inlined into the public JavaScript
 * bundle, so building addresses in would publish both private emails to anyone
 * who opens the site.
 *
 * The real addresses live only in:
 *   - Supabase Auth (the accounts themselves)
 *   - the `ALLOWED_EMAILS` secret read by the `create-account` edge function
 *   - the `email_recipient` column of each assignment row
 *
 *   VITE_PARTNER_ONE_NAME / VITE_PARTNER_TWO_NAME
 */
export interface PartnerIdentity {
  id: PartnerId;
  name: string;
  initials: string;
}

function envValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : '';
  return `${first}${last}`.toUpperCase() || '?';
}

const oneName = envValue(import.meta.env.VITE_PARTNER_ONE_NAME, 'Partner one');
const twoName = envValue(import.meta.env.VITE_PARTNER_TWO_NAME, 'Partner two');

export const PARTNER_IDENTITIES: [PartnerIdentity, PartnerIdentity] = [
  { id: 'sam', name: oneName, initials: initialsFor(oneName) },
  { id: 'sammy', name: twoName, initials: initialsFor(twoName) },
];

/**
 * Non-routable addresses used only by the browser-only demo store, so a local
 * build never needs (or contains) a real address.
 */
export function localDemoEmail(id: PartnerId): string {
  return `${id}@partner.local`;
}

export function identityFor(id: PartnerId): PartnerIdentity {
  return PARTNER_IDENTITIES.find((identity) => identity.id === id) ?? PARTNER_IDENTITIES[0];
}
