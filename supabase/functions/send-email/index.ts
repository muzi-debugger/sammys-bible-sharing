// ---------------------------------------------------------------------------
// supabase/functions/send-email/index.ts
//
// Sends the weekly Scripture email and the daily encouragement through Brevo.
// Deploy with:  supabase functions deploy send-email --no-verify-jwt
// Secrets:      BREVO_API_KEY, EMAIL_FROM, APP_URL, CRON_SECRET
//
// Brevo *SMTP* keys only work over SMTP. Edge functions cannot open SMTP
// sockets, so this uses Brevo's HTTPS API with an API v3 key instead.
//
// Honesty rules kept from the app:
//   * until a licensed NLT provider is configured, passages are placeholders and
//     the email says so — no substitute translation is ever quoted as NLT
//   * delivery status is only recorded from what Brevo actually returned
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface AssignmentRow {
  id: string;
  cycle_id: string;
  user_id: string;
  reference: string;
  passage_text: string;
  attribution: string;
  content_kind: 'licensed' | 'placeholder';
  theme: string;
  email_status: string;
  email_recipient: string;
}

interface DailyRow {
  day: string;
  reference: string;
  passage_text: string;
  attribution: string;
  content_kind: 'licensed' | 'placeholder';
  theme: string;
}

function isoWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const shell = (title: string, intro: string, body: string, footer: string) => `
<div style="margin:0;padding:28px 16px;background:#FAF7F0;font-family:Georgia,'Times New Roman',serif;color:#302F2A">
  <div style="max-width:560px;margin:0 auto;background:#FFFEFA;border:1px solid #DCD3C2;border-radius:16px;overflow:hidden">
    <div style="padding:26px 30px 8px">
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a8578">Sammy&rsquo;s Bible Sharing</p>
      <h1 style="margin:10px 0 6px;font-weight:500;font-size:26px;line-height:1.25;color:#34483A">${title}</h1>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#6b6a62;font-style:italic">${intro}</p>
    </div>
    <div style="padding:8px 30px 24px">${body}</div>
    <div style="padding:16px 30px 24px;border-top:1px solid #E7E0D2">
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#8a8578">${footer}</p>
    </div>
  </div>
</div>`;

function weeklyHtml(name: string, row: AssignmentRow, appUrl: string): string {
  const isPlaceholder = row.content_kind === 'placeholder';
  const passage = isPlaceholder
    ? `<p style="margin:0 0 12px;font-size:13px;color:#8a6f3f;font-family:Helvetica,Arial,sans-serif;letter-spacing:1px;text-transform:uppercase">Preview — no licensed NLT text yet</p>
       <p style="margin:0;font-size:16px;line-height:1.9;color:#6b6a62;font-style:italic">The New Living Translation text of ${row.reference} is not included in this email. No substitute translation is used. Once the NLT licence is approved the full passage will appear here.</p>`
    : row.passage_text
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 14px;font-size:17px;line-height:1.95">${p}</p>`)
        .join('');

  return shell(
    `${name}, your Scripture for Sunday`,
    `${row.reference} · New Living Translation`,
    `<div style="margin:6px 0 20px;padding:22px;background:#F7F2E8;border-radius:14px">
       <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#B87960">${row.theme}</p>
       ${passage}
     </div>
     <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#34483A">Three questions to carry through the week</p>
     <ol style="margin:0 0 20px;padding-left:18px;font-size:15px;line-height:1.8;color:#4a4a44">
       <li>What stands out to you in this passage?</li>
       <li>What does it invite you to reflect on?</li>
       <li>What would you like to discuss together on Sunday?</li>
     </ol>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4a4a44">Your notes are private to you. On Sunday you will read both passages together.</p>
     <p style="margin:0"><a href="${appUrl}/#/sunday-study" style="display:inline-block;background:#34483A;color:#FFFEFA;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:13px;padding:12px 20px;border-radius:10px">Open my Sunday Study</a></p>`,
    `${row.attribution}`
  );
}

function dailyHtml(name: string, row: DailyRow, appUrl: string): string {
  const isPlaceholder = row.content_kind === 'placeholder';
  const passage = isPlaceholder
    ? `<p style="margin:0;font-size:16px;line-height:1.9;color:#6b6a62;font-style:italic">The New Living Translation text of ${row.reference} is not included yet — no substitute translation is used.</p>`
    : row.passage_text
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 12px;font-size:17px;line-height:1.95">${p}</p>`)
        .join('');

  return shell(
    `A little encouragement for today`,
    `${name}, a moment of stillness`,
    `<div style="margin:6px 0 18px;padding:20px;background:#F7F2E8;border-radius:14px">
       <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#B87960">${row.theme}</p>
       ${passage}
       <p style="margin:12px 0 0;font-style:italic;font-size:15px;color:#34483A">${row.reference}</p>
     </div>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4a4a44">What would it look like to carry this into your day?</p>
     <p style="margin:0"><a href="${appUrl}/" style="display:inline-block;background:#34483A;color:#FFFEFA;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:13px;padding:12px 20px;border-radius:10px">Open Sammy&rsquo;s Bible Sharing</a></p>`,
    `${row.attribution}`
  );
}

async function sendViaBrevo(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; messageId?: string; detail: string }> {
  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': input.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseSender(input.from),
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, detail: `Brevo ${response.status}: ${text.slice(0, 300)}` };
  }
  let messageId: string | undefined;
  try {
    messageId = (JSON.parse(text) as { messageId?: string }).messageId;
  } catch {
    /* Brevo returns { messageId } normally */
  }
  return { ok: true, messageId, detail: 'Accepted by Brevo' };
}

function parseSender(value: string): { email: string; name?: string } {
  const match = /^(.*)<(.+)>$/.exec(value.trim());
  if (match) return { name: match[1].trim() || undefined, email: match[2].trim() };
  return { email: value.trim() };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const brevoKey = Deno.env.get('BREVO_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!supabaseUrl || !serviceKey) return json({ error: 'Supabase env missing' }, 500);
  if (!brevoKey || !from) {
    return json(
      {
        error:
          'Email provider is not configured. Set BREVO_API_KEY (API v3 key, not the SMTP key) and EMAIL_FROM.',
      },
      503,
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);

  let body: { mode?: string; to?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* allow empty body -> weekly */
  }
  const mode = body.mode ?? 'weekly';

  // Authorise: cron secret for scheduled runs, or a signed-in user for tests.
  const cronHeader = request.headers.get('x-cron-secret');
  const isCron = Boolean(cronSecret && cronHeader && cronHeader === cronSecret);
  let callerEmail: string | null = null;

  if (!isCron) {
    const auth = request.headers.get('Authorization') ?? '';
    const { data } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    callerEmail = data.user?.email ?? null;
    if (!callerEmail) return json({ error: 'Not authorised' }, 401);
  }

  const results: unknown[] = [];

  if (mode === 'test') {
    const to = callerEmail;
    if (!to) return json({ error: 'No signed-in email for a test send' }, 400);
    const sent = await sendViaBrevo({
      apiKey: brevoKey,
      from,
      to,
      subject: 'Test · Sammy’s Bible Sharing',
      html: shell(
        'Delivery works',
        'This is a test from your account',
        `<p style="margin:0;font-size:16px;line-height:1.9">Brevo accepted this message for <strong>${to}</strong>. Weekly and daily emails will use the same sender.</p>`,
        'Sent from your preview build.',
      ),
    });
    await admin.from('email_deliveries').insert({
      kind: 'daily',
      recipient: to,
      subject: 'Test · Sammy’s Bible Sharing',
      provider_message_id: sent.messageId ?? null,
      status: sent.ok ? 'accepted' : 'failed',
      detail: sent.detail,
    });
    return json({ mode, sent });
  }

  if (mode === 'weekly') {
    const cycleId = isoWeekId(new Date());
    const { data: assignments, error } = await admin
      .from('weekly_assignments')
      .select('id, cycle_id, user_id, reference, passage_text, attribution, content_kind, theme, email_status, email_recipient')
      .eq('cycle_id', cycleId);

    if (error) return json({ error: error.message }, 500);
    if (!assignments || assignments.length === 0) {
      return json({ mode, cycleId, skipped: 'no assignments for this cycle' });
    }

    const { data: profiles } = await admin.from('profiles').select('id, display_name');
    const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string]));

    for (const row of assignments as AssignmentRow[]) {
      // Never re-send an accepted/delivered message.
      if (row.email_status === 'accepted' || row.email_status === 'delivered') {
        results.push({ reference: row.reference, status: 'already-sent' });
        continue;
      }
      const sent = await sendViaBrevo({
        apiKey: brevoKey,
        from,
        to: row.email_recipient,
        subject: 'Your Scripture for Sunday | Sammy’s Bible Sharing',
        html: weeklyHtml(names.get(row.user_id) ?? 'friend', row, appUrl),
      });

      await admin
        .from('weekly_assignments')
        .update({
          email_status: sent.ok ? 'accepted' : 'failed',
          email_detail: sent.detail,
        })
        .eq('id', row.id);

      await admin.from('email_deliveries').insert({
        kind: 'weekly',
        recipient: row.email_recipient,
        subject: 'Your Scripture for Sunday | Sammy’s Bible Sharing',
        provider_message_id: sent.messageId ?? null,
        status: sent.ok ? 'accepted' : 'failed',
        detail: sent.detail,
      });

      results.push({ reference: row.reference, to: row.email_recipient, status: sent.ok ? 'accepted' : 'failed', detail: sent.detail });
    }

    return json({ mode, cycleId, results });
  }

  if (mode === 'daily') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: daily } = await admin
      .from('daily_scriptures')
      .select('day, reference, passage_text, attribution, content_kind, theme')
      .eq('day', today)
      .maybeSingle();

    if (!daily) return json({ mode, skipped: 'no daily scripture for today' });

    const { data: profiles } = await admin.from('profiles').select('id, display_name, email');
    for (const profile of profiles ?? []) {
      const sent = await sendViaBrevo({
        apiKey: brevoKey,
        from,
        to: profile.email as string,
        subject: 'A little encouragement for today',
        html: dailyHtml(profile.display_name as string, daily as DailyRow, appUrl),
      });
      await admin.from('email_deliveries').insert({
        kind: 'daily',
        recipient: profile.email as string,
        subject: 'A little encouragement for today',
        provider_message_id: sent.messageId ?? null,
        status: sent.ok ? 'accepted' : 'failed',
        detail: sent.detail,
      });
      results.push({ to: profile.email, status: sent.ok ? 'accepted' : 'failed' });
    }
    return json({ mode, day: today, results });
  }

  return json({ error: `Unknown mode: ${mode}` }, 400);
});
