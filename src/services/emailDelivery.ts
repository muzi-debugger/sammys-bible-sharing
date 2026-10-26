import { DAILY_EMAIL_SUBJECT, WEEKLY_EMAIL_SUBJECT } from '@/lib/dates';
import { mutateDatabase } from '@/services/storage';
import type {
  DailyScriptureRecord,
  DeliveryStatus,
  EmailAttempt,
  EmailDelivery,
  PartnerProfile,
  WeeklyAssignment,
} from '@/types';

export interface WeeklyEmailInput {
  partner: PartnerProfile;
  assignment: WeeklyAssignment;
  sundayStudyUrl: string;
}

export interface DailyEmailInput {
  partner: PartnerProfile;
  record: DailyScriptureRecord;
  appUrl: string;
}

export interface ReminderEmailInput {
  partner: PartnerProfile;
  sundayStudyUrl: string;
  cycleWeekStart: string;
}

export interface EmailDeliveryService {
  deliverWeeklyScripture(input: WeeklyEmailInput): Promise<EmailDelivery>;
  deliverDailyScripture(input: DailyEmailInput): Promise<EmailDelivery>;
  sendSundayReminder(input: ReminderEmailInput): Promise<EmailDelivery>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function logAttempt(attempt: EmailAttempt) {
  mutateDatabase((draft) => {
    draft.emailLog.unshift(attempt);
    draft.emailLog = draft.emailLog.slice(0, 40);
  });
}

function previewDelivery(recipient: string, subject: string, kind: EmailAttempt['kind']): EmailDelivery {
  const detail =
    'Preview mode — no email was sent. Connect a transactional email provider server-side to enable delivery.';
  logAttempt({
    id: `email_${crypto.randomUUID()}`,
    kind,
    recipient,
    subject,
    createdAt: new Date().toISOString(),
    status: 'preview',
    detail,
  });
  return {
    status: 'preview',
    recipient,
    attemptedAt: new Date().toISOString(),
    detail,
  };
}

/**
 * Preview email service.
 *
 * It never reports `sent`/`delivered`, because no provider accepted the message.
 * The status vocabulary matches what a real provider would return so the UI does
 * not need to change when Resend (or similar) is wired in.
 */
export class PreviewEmailDeliveryService implements EmailDeliveryService {
  async deliverWeeklyScripture({ partner, assignment }: WeeklyEmailInput): Promise<EmailDelivery> {
    await wait(160);
    // The browser intentionally holds no addresses, so only compare when one is
    // actually known — otherwise an empty value would look like a mismatch.
    if (partner.email && partner.email !== assignment.emailDelivery.recipient) {
      return {
        status: 'failed',
        recipient: partner.email,
        attemptedAt: new Date().toISOString(),
        detail: 'Recipient mismatch — the assignment belongs to a different partner.',
      };
    }
    return previewDelivery(partner.email, WEEKLY_EMAIL_SUBJECT, 'weekly');
  }

  async deliverDailyScripture({ partner }: DailyEmailInput): Promise<EmailDelivery> {
    await wait(120);
    return previewDelivery(partner.email, DAILY_EMAIL_SUBJECT, 'daily');
  }

  async sendSundayReminder({ partner }: ReminderEmailInput): Promise<EmailDelivery> {
    await wait(120);
    return previewDelivery(partner.email, 'Your Sunday Study is waiting', 'sunday-reminder');
  }
}

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  preview: 'Preview only',
  queued: 'Queued',
  accepted: 'Accepted by provider',
  delivered: 'Delivered',
  bounced: 'Bounced',
  failed: 'Failed',
};

export const emailDeliveryService: EmailDeliveryService = new PreviewEmailDeliveryService();
