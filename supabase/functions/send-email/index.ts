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
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8a8578">Sammy Bible Sharing</p>
      <h1 style="margin:10px 0 6px;font-weight:500;font-size:26px;line-height:1.25;color:#34483A">${title}</h1>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#6b6a62;font-style:italic">${intro}</p>
    </div>
    <div style="padding:8px 30px 24px">${body}</div>
    <div style="padding:16px 30px 24px;border-top:1px solid #E7E0D2">
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#8a8578">${footer}</p>
    </div>
  </div>
</div>`;

function weeklyHtml(
  name: string,
  row: AssignmentRow,
  content: { text: string; attribution: string; contentKind: 'licensed' | 'placeholder'; reference: string },
  appUrl: string,
): string {
  const isPlaceholder = content.contentKind === 'placeholder';
  const passage = isPlaceholder
    ? `<p style="margin:0 0 12px;font-size:13px;color:#8a6f3f;font-family:Helvetica,Arial,sans-serif;letter-spacing:1px;text-transform:uppercase">Preview — no licensed NLT text yet</p>
       <p style="margin:0;font-size:16px;line-height:1.9;color:#6b6a62;font-style:italic">The New Living Translation text of ${content.reference} is not included in this email. No substitute translation is used. Once the NLT licence is approved the full passage will appear here.</p>`
    : content.text
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 14px;font-size:17px;line-height:1.95">${p}</p>`)
        .join('');

  return shell(
    `${name}, your Scripture for Sunday`,
    `${content.reference} · New Living Translation`,
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
    `${content.attribution}`,
  );
}

function dailyHtml(
  name: string,
  content: { text: string; attribution: string; contentKind: 'licensed' | 'placeholder'; reference: string },
  theme: string,
  appUrl: string,
): string {
  const isPlaceholder = content.contentKind === 'placeholder';
  const passage = isPlaceholder
    ? `<p style="margin:0;font-size:16px;line-height:1.9;color:#6b6a62;font-style:italic">The New Living Translation text of ${content.reference} is not included yet — no substitute translation is used.</p>`
    : content.text
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 12px;font-size:17px;line-height:1.95">${p}</p>`)
        .join('');

  return shell(
    `A little encouragement for today`,
    `${name}, a moment of stillness`,
    `<div style="margin:6px 0 18px;padding:20px;background:#F7F2E8;border-radius:14px">
       <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#B87960">${theme}</p>
       ${passage}
       <p style="margin:12px 0 0;font-style:italic;font-size:15px;color:#34483A">${content.reference}</p>
     </div>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4a4a44">What would it look like to carry this into your day?</p>
     <p style="margin:0"><a href="${appUrl}/" style="display:inline-block;background:#34483A;color:#FFFEFA;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:13px;padding:12px 20px;border-radius:10px">Open Sammy Bible Sharing</a></p>`,
    `${content.attribution}`,
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
  const trimmed = value.trim();
  const angle = /^(.*)<([^>]+)>$/.exec(trimmed);
  if (angle) return { name: angle[1].trim() || undefined, email: angle[2].trim() };
  const parts = trimmed.split(/\s+/);
  const email = parts.find((part) => part.includes('@')) ?? trimmed;
  const name = trimmed
    .replace(email, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
  return { email, name: name || undefined };
}

// --- Licensed NLT enrichment ------------------------------------------------
// Placeholder rows created by SQL are upgraded to real NLT text here, using the
// API.Bible key held server-side. If enrichment fails the placeholder is kept
// and the email stays honest — a substitute translation is never used.

const API_BIBLE_BASE = Deno.env.get('API_BIBLE_BASE_URL') ?? 'https://rest.api.bible/v1';
const API_BIBLE_KEY = Deno.env.get('API_BIBLE_KEY') ?? '';

const USFM: Record<string, string> = {
  psalm: 'PSA', psalms: 'PSA', proverbs: 'PRO', isaiah: 'ISA', jeremiah: 'JER',
  lamentations: 'LAM', joshua: 'JOS', job: 'JOB', john: 'JHN', romans: 'ROM',
  '1 corinthians': '1CO', '2 corinthians': '2CO', galatians: 'GAL', ephesians: 'EPH',
  philippians: 'PHP', colossians: 'COL', '1 thessalonians': '1TH', '2 thessalonians': '2TH',
  '1 timothy': '1TI', '2 timothy': '2TI', hebrews: 'HEB', james: 'JAS', matthew: 'MAT',
  mark: 'MRK', luke: 'LUK', acts: 'ACT', '1 peter': '1PE', '2 peter': '2PE',
  '1 john': '1JN', micah: 'MIC', revelation: 'REV', ecclesiastes: 'ECC',
};

let nltBibleId: string | null | undefined;

async function resolveNltId(): Promise<string | null> {
  if (nltBibleId !== undefined) return nltBibleId;
  try {
    const response = await fetch(`${API_BIBLE_BASE}/bibles?language=eng`, {
      headers: { 'api-key': API_BIBLE_KEY },
    });
    if (!response.ok) {
      nltBibleId = null;
      return null;
    }
    const payload = (await response.json()) as {
      data?: Array<{ id: string; abbreviationLocal?: string; name?: string }>;
    };
    nltBibleId =
      (payload.data ?? []).find(
        (b) =>
          (b.abbreviationLocal ?? '').toUpperCase() === 'NLT' ||
          /new living translation/i.test(b.name ?? ''),
      )?.id ?? null;
    return nltBibleId;
  } catch {
    nltBibleId = null;
    return null;
  }
}

interface PassageContent {
  reference: string;
  text: string;
  attribution: string;
  contentKind: 'licensed' | 'placeholder';
}

async function fetchNlt(reference: string): Promise<PassageContent | null> {
  if (!API_BIBLE_KEY) return null;
  const match = /^(.+?)\s(\d+):(\d+)(?:-(\d+))?$/.exec(reference.trim());
  if (!match) return null;
  const [, book, chapter, start, end] = match;
  const usfm = USFM[book.toLowerCase()];
  if (!usfm) return null;

  const bibleId = await resolveNltId();
  if (!bibleId) return null;

  const verseStart = Number(start);
  const verseEnd = Number(end ?? start);
  const passageId =
    verseEnd !== verseStart
      ? `${usfm}.${chapter}.${verseStart}-${usfm}.${chapter}.${verseEnd}`
      : `${usfm}.${chapter}.${verseStart}`;

  const query = new URLSearchParams({
    'content-type': 'text',
    'include-verse-numbers': 'false',
    'include-chapter-numbers': 'false',
  });

  try {
    const response = await fetch(
      `${API_BIBLE_BASE}/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}?${query.toString()}`,
      { headers: { 'api-key': API_BIBLE_KEY } },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data: { reference: string; content: string; copyright?: string };
    };
    const text = payload.data.content
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!text) return null;
    return {
      reference: payload.data.reference || reference,
      text,
      attribution:
        payload.data.copyright?.trim() ||
        'New Living Translation, copyright © Tyndale House Publishers. Used by permission.',
      contentKind: 'licensed',
    };
  } catch {
    return null;
  }
}

/** Uses stored text when it is already licensed, otherwise tries to fetch NLT. */
async function resolveContent(
  reference: string,
  storedText: string,
  storedAttribution: string,
  storedKind: 'licensed' | 'placeholder',
): Promise<PassageContent> {
  if (storedKind === 'licensed') {
    return {
      reference,
      text: storedText,
      attribution: storedAttribution,
      contentKind: 'licensed',
    };
  }
  const fetched = await fetchNlt(reference);
  return (
    fetched ?? {
      reference,
      text: storedText,
      attribution: storedAttribution,
      contentKind: 'placeholder',
    }
  );
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
    const to = callerEmail ?? (isCron ? (body.to ?? '').trim() : '');
    if (!to) {
      return json(
        {
          error:
            'A test sent with the cron secret needs an explicit recipient: {"mode":"test","to":"you@example.com"}',
        },
        400,
      );
    }
    const sent = await sendViaBrevo({
      apiKey: brevoKey,
      from,
      to,
      subject: 'Test · Sammy Bible Sharing',
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
      subject: 'Test · Sammy Bible Sharing',
      provider_message_id: sent.messageId ?? null,
      status: sent.ok ? 'accepted' : 'failed',
      detail: sent.detail,
    });
    return json({ mode, sent });
  }

  if (mode === 'prepare') {
    // Upgrades placeholder rows to licensed NLT text. Sends nothing.
    const cycleId = isoWeekId(new Date());
    const { data: rows } = await admin
      .from('weekly_assignments')
      .select('id, reference, passage_text, attribution, content_kind')
      .eq('cycle_id', cycleId);

    let upgraded = 0;
    for (const row of rows ?? []) {
      if (row.content_kind === 'licensed') continue;
      const content = await resolveContent(
        row.reference as string,
        row.passage_text as string,
        row.attribution as string,
        'placeholder',
      );
      if (content.contentKind !== 'licensed') continue;
      await admin
        .from('weekly_assignments')
        .update({
          passage_text: content.text,
          attribution: content.attribution,
          content_kind: 'licensed',
        })
        .eq('id', row.id);
      upgraded += 1;
    }

    await admin.rpc('ensure_today_daily').then(
      () => undefined,
      () => undefined,
    );
    const prepareToday = new Date().toISOString().slice(0, 10);
    const { data: daily } = await admin
      .from('daily_scriptures')
      .select('day, reference, passage_text, attribution, content_kind')
      .eq('day', prepareToday)
      .maybeSingle();

    let dailyUpgraded = false;
    if (daily && daily.content_kind === 'placeholder') {
      const content = await resolveContent(
        daily.reference as string,
        daily.passage_text as string,
        daily.attribution as string,
        'placeholder',
      );
      if (content.contentKind === 'licensed') {
        await admin
          .from('daily_scriptures')
          .update({
            passage_text: content.text,
            attribution: content.attribution,
            content_kind: 'licensed',
          })
          .eq('day', prepareToday);
        dailyUpgraded = true;
      }
    }

    return json({ mode, cycleId, upgraded, dailyUpgraded, nltAvailable: Boolean(API_BIBLE_KEY) });
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
      const content = await resolveContent(
        row.reference,
        row.passage_text,
        row.attribution,
        row.content_kind,
      );

      const sent = await sendViaBrevo({
        apiKey: brevoKey,
        from,
        to: row.email_recipient,
        subject: 'Your Scripture for Sunday | Sammy Bible Sharing',
        html: weeklyHtml(names.get(row.user_id) ?? 'friend', row, content, appUrl),
      });

      if (content.contentKind === 'licensed' && row.content_kind === 'placeholder') {
        await admin
          .from('weekly_assignments')
          .update({
            passage_text: content.text,
            attribution: content.attribution,
            content_kind: 'licensed',
          })
          .eq('id', row.id);
      }

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
        subject: 'Your Scripture for Sunday | Sammy Bible Sharing',
        provider_message_id: sent.messageId ?? null,
        status: sent.ok ? 'accepted' : 'failed',
        detail: sent.detail,
      });

      results.push({ reference: row.reference, to: row.email_recipient, status: sent.ok ? 'accepted' : 'failed', detail: sent.detail });
    }

    return json({ mode, cycleId, results });
  }

  if (mode === 'daily') {
    // Creates today's passage if the cron has not run yet.
    await admin.rpc('ensure_today_daily').then(
      () => undefined,
      () => undefined,
    );
    const today = new Date().toISOString().slice(0, 10);
    const { data: daily, error: dailyError } = await admin
      .from('daily_scriptures')
      .select('day, reference, passage_text, attribution, content_kind, theme')
      .eq('day', today)
      .maybeSingle();

    if (!daily) {
      return json({
        mode,
        skipped: 'no daily scripture for today',
        dailyError: dailyError?.message ?? null,
        hint: 'Run supabase/003-email-and-cron.sql so ensure_today_daily() exists.',
      });
    }

    const content = await resolveContent(
      daily.reference,
      daily.passage_text,
      daily.attribution,
      daily.content_kind,
    );

    if (content.contentKind === 'licensed' && daily.content_kind === 'placeholder') {
      await admin
        .from('daily_scriptures')
        .update({
          passage_text: content.text,
          attribution: content.attribution,
          content_kind: 'licensed',
        })
        .eq('day', today);
    }

    const explicitTo = isCron ? (body.to ?? '').trim() : '';
    const { data: profiles } = await admin.from('profiles').select('id, display_name, email');
    const recipients = explicitTo
      ? [{ display_name: 'friend', email: explicitTo }]
      : profiles ?? [];

    for (const profile of recipients) {
      const sent = await sendViaBrevo({
        apiKey: brevoKey,
        from,
        to: profile.email as string,
        subject: 'A little encouragement for today',
        html: dailyHtml(profile.display_name as string, content, daily.theme, appUrl),
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
    return json({ mode, day: today, reference: content.reference, contentKind: content.contentKind, results });
  }

  return json({ error: `Unknown mode: ${mode}` }, 400);
});
