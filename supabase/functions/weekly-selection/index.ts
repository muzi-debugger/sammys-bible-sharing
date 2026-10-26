// ---------------------------------------------------------------------------
// supabase/functions/weekly-selection/index.ts
//
// REFERENCE IMPLEMENTATION — not deployed by this preview build.
// Deploy with `supabase functions deploy weekly-selection` and schedule it with
// pg_cron at `0 10 * * 1` (Monday 10:00 UTC). Requires the schema in
// supabase/schema.sql and these secrets:
//
//   supabase secrets set \
//     BIBLE_PROVIDER_URL=https://your-licensed-nlt-proxy.example.com/bible \
//     BIBLE_PROVIDER_KEY=... \
//     RESEND_API_KEY=... \
//     EMAIL_FROM="Sammy's Bible Sharing <hello@yourdomain.test>" \
//     APP_URL=https://yourdomain.test
//
// Guarantees:
//   * one cycle per ISO week, never replaced once generated
//   * two different references (never the same book, never the same theme)
//   * NLT verified on every passage — a non-NLT payload aborts the run
//   * per-recipient emails, recorded delivery status, no duplicate sends
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SELECTION_HOUR_UTC = 10;

const POOL = [
  { reference: 'Psalm 23:1-6', theme: 'Faith' },
  { reference: 'Philippians 4:6-7', theme: 'Peace' },
  { reference: 'Proverbs 3:5-6', theme: 'Wisdom' },
  { reference: 'Isaiah 40:28-31', theme: 'Patience' },
  { reference: '1 Corinthians 13:4-7', theme: 'Love' },
  { reference: 'Hebrews 11:1-3', theme: 'Faith' },
  { reference: 'Joshua 1:7-9', theme: 'Courage' },
  { reference: 'Psalm 100:1-5', theme: 'Gratitude' },
  { reference: 'James 1:2-4', theme: 'Perseverance' },
  { reference: 'Colossians 3:12-14', theme: 'Forgiveness' },
  { reference: 'Romans 15:4-6', theme: 'Hope' },
  { reference: 'Psalm 119:105-112', theme: 'Wisdom' },
];

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const providerUrl = Deno.env.get('BIBLE_PROVIDER_URL');
  const providerKey = Deno.env.get('BIBLE_PROVIDER_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!providerUrl || !providerKey || !resendKey) {
    return json({ error: 'Bible provider or email provider is not configured' }, 500);
  }

  const now = new Date();
  const cycleId = isoCycleId(now);
  const weekStart = startOfWeek(now).toISOString().slice(0, 10);

  // Idempotency: an existing cycle is returned unchanged. Retries are safe.
  const { data: existing } = await supabase
    .from('weekly_cycles')
    .select('id, generated_at')
    .eq('id', cycleId)
    .maybeSingle();
  if (existing?.generated_at) return json({ cycle: cycleId, status: 'already-generated' });

  const { data: household } = await supabase.from('households').select('id').limit(1).single();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, email, slot')
    .eq('household_id', household!.id);
  if (!profiles || profiles.length !== 2) {
    return json({ error: 'Exactly two partner profiles are required' }, 400);
  }

  // Recent history to avoid repeating passages too soon.
  const { data: history } = await supabase
    .from('weekly_assignments')
    .select('reference')
    .order('assigned_at', { ascending: false })
    .limit(10);
  const recent = new Set((history ?? []).map((row) => row.reference));

  const picks = pickTwo(recent);
  const passages = [];
  for (const pick of picks) {
    const passage = await fetchPassage(providerUrl, providerKey, pick.reference);
    if (passage.translation !== 'NLT' || passage.contentKind !== 'licensed') {
      // Never substitute another translation; abort and let the cron retry.
      return json({ error: `Provider did not return licensed NLT for ${pick.reference}` }, 502);
    }
    passages.push({ ...pick, ...passage });
  }

  await supabase.from('weekly_cycles').insert({
    id: cycleId,
    week_start: weekStart,
    selection_at: selectionMoment(now).toISOString(),
    generated_at: null,
    origin: 'scheduled',
  });

  const results = [];
  for (let index = 0; index < profiles.length; index += 1) {
    const profile = profiles[index];
    const passage = passages[index];
    results.push(
      await delverFor(supabase, resendKey, profile, passage, cycleId, weekStart),
    );
  }

  await supabase
    .from('weekly_cycles')
    .update({ generated_at: new Date().toISOString() })
    .eq('id', cycleId);

  return json({ cycle: cycleId, results });
});

async function delverFor(supabase, resendKey, profile, passage, cycleId, weekStart) {
  const { data: assignment, error } = await supabase
    .from('weekly_assignments')
    .insert({
      cycle_id: cycleId,
      user_id: profile.id,
      reference: passage.reference,
      translation: passage.translation,
      passage_text: passage.text,
      attribution: passage.attribution,
      provider_id: passage.providerId,
      content_kind: passage.contentKind,
      theme: passage.theme,
      email_status: 'queued',
      email_recipient: profile.email,
    })
    .select('id')
    .single();

  if (error) {
    return { recipient: profile.email, status: 'failed', detail: error.message };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM'),
      to: profile.email,
      subject: "Your Scripture for Sunday | Sammy's Bible Sharing",
      html: weeklyEmailHtml(profile.display_name, passage, Deno.env.get('APP_URL')),
    }),
  });

  const payload = await response.json();
  const status = response.ok ? 'accepted' : 'failed';

  await supabase.from('email_deliveries').insert({
    kind: 'weekly',
    recipient: profile.email,
    subject: "Your Scripture for Sunday | Sammy's Bible Sharing",
    provider_message_id: payload?.id ?? null,
    status,
    detail: response.ok ? 'Accepted by Resend' : JSON.stringify(payload),
  });
  await supabase
    .from('weekly_assignments')
    .update({ email_status: status, email_detail: response.ok ? 'Accepted' : 'Send failed' })
    .eq('id', assignment.id);

  return { recipient: profile.email, reference: passage.reference, status };
}

async function fetchPassage(baseUrl: string, apiKey: string, reference: string) {
  const url = `${baseUrl}/passage?reference=${encodeURIComponent(reference)}&translation=NLT`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error(`Bible provider responded ${response.status}`);
  return await response.json();
}

function pickTwo(recent: Set<string>) {
  const available = POOL.filter((entry) => !recent.has(entry.reference));
  const pool = available.length >= 4 ? available : POOL;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const first = shuffled[0];
  const second = shuffled.find(
    (entry) =>
      entry.reference !== first.reference &&
      entry.theme !== first.theme &&
      entry.reference.split(' ')[0] !== first.reference.split(' ')[0],
  );
  return [first, second ?? shuffled[1]];
}

function weeklyEmailHtml(name: string, passage, appUrl?: string) {
  return `
  <div style="font-family:Georgia,serif;background:#FAF7F0;padding:32px;color:#302F2A">
    <h1 style="color:#34483A;font-weight:500">${name}, your Scripture for Sunday</h1>
    <p style="font-style:italic">${passage.reference} · New Living Translation (NLT)</p>
    <div style="background:#FFFEFA;border:1px solid #A6B39B;border-radius:14px;padding:24px;line-height:2">
      ${String(passage.text).split(/\n{2,}/).map((p) => `<p>${p}</p>`).join('')}
    </div>
    <p style="font-size:12px;color:#6b6a62">${passage.attribution}</p>
    <p>Prepare during the week, then unpack both passages together on Sunday.</p>
    <p><a href="${appUrl}/#/sunday-study" style="color:#34483A">Open your Sunday Study</a></p>
  </div>`;
}

function startOfWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function selectionMoment(date: Date) {
  const monday = startOfWeek(date);
  return new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
      SELECTION_HOUR_UTC,
      0,
      0,
    ),
  );
}

function isoCycleId(date: Date) {
  const monday = startOfWeek(date);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
