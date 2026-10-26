import type { PartnerId } from '@/types';

/**
 * The two partner identities.
 *
 * The real names and addresses live in `.env.local` (gitignored) for local use
 * and in GitHub Actions secrets for the deployed build, so the repository itself
 * never contains personal email addresses.
 *
 *   VITE_PARTNER_ONE_NAME / VITE_PARTNER_ONE_EMAIL
 *   VITE_PARTNER_TWO_NAME / VITE_PARTNER_TWO_EMAIL
 */
export interface PartnerIdentity {
  id: PartnerId;
  name: string;
  email: string;
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
const oneEmail = envValue(import.meta.env.VITE_PARTNER_ONE_EMAIL, 'partner.one@example.invalid');
const twoEmail = envValue(import.meta.env.VITE_PARTNER_TWO_EMAIL, 'partner.two@example.invalid');

export const PARTNER_IDENTITIES: [PartnerIdentity, PartnerIdentity] = [
  { id: 'sam', name: oneName, email: oneEmail, initials: initialsFor(oneName) },
  { id: 'sammy', name: twoName, email: twoEmail, initials: initialsFor(twoName) },
];

/** False when the build has no partner addresses, so the UI can say so instead of pretending. */
export const identitiesConfigured = Boolean(
  import.meta.env.VITE_PARTNER_ONE_EMAIL?.trim() &&
    import.meta.env.VITE_PARTNER_TWO_EMAIL?.trim(),
);

export function identityFor(id: PartnerId): PartnerIdentity {
  return PARTNER_IDENTITIES.find((identity) => identity.id === id) ?? PARTNER_IDENTITIES[0];
}
