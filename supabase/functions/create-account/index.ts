// ---------------------------------------------------------------------------
// supabase/functions/create-account/index.ts
//
// Creates the two account holders without any confirmation email. The invited
// addresses are validated HERE, on the server — the browser check is only a
// convenience. Everything else is rejected.
//
// Secrets: ALLOWED_EMAILS (comma separated) or PARTNER_ONE_EMAIL/PARTNER_TWO_EMAIL
// Deploy:  supabase functions deploy create-account --no-verify-jwt
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

function allowedEmails(): string[] {
  const list = (Deno.env.get('ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (list.length > 0) return list;

  return [Deno.env.get('PARTNER_ONE_EMAIL'), Deno.env.get('PARTNER_TWO_EMAIL')]
    .map((value) => (value ?? '').trim().toLowerCase())
    .filter(Boolean);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Supabase env missing' }, 500);

  let body: { email?: string; password?: string; name?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const name = (body.name ?? '').trim();

  const allowed = allowedEmails();
  if (allowed.length === 0) {
    return json(
      {
        error:
          'No invited addresses are configured on the server. Set ALLOWED_EMAILS for this function.',
      },
      503,
    );
  }
  if (!allowed.includes(email)) {
    return json(
      { error: 'This application is for two people. Only the invited addresses can sign up.' },
      403,
    );
  }
  if (password.length < 8) {
    return json({ error: 'Use at least 8 characters for your password.' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const created = await admin.auth.admin.createUser({
    email,
    password,
    // No confirmation email: the invite check above is the gate.
    email_confirm: true,
    user_metadata: { display_name: name || email.split('@')[0] },
  });

  if (!created.error && created.data.user) {
    return json({ status: 'created', email });
  }

  const message = (created.error?.message ?? '').toLowerCase();
  if (!message.includes('already') && !message.includes('exists')) {
    return json({ error: created.error?.message ?? 'Could not create the account' }, 400);
  }

  // The address already has a user (often from an earlier unconfirmed attempt).
  const existing = await findUserByEmail(admin, email);
  if (!existing) {
    return json({ error: 'That account already exists. Sign in instead.' }, 409);
  }
  if (existing.email_confirmed_at) {
    return json(
      {
        status: 'already-registered',
        error: 'That account is already set up. Sign in, or use “Forgot password”.',
      },
      409,
    );
  }

  // Unconfirmed leftover: activate it and adopt the password just chosen.
  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { display_name: name || existing.user_metadata?.display_name || email.split('@')[0] },
  });
  if (updated.error) return json({ error: updated.error.message }, 400);

  return json({ status: 'activated', email });
});

async function findUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string; email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> } | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const match = data.users.find((user) => (user.email ?? '').toLowerCase() === email);
    if (match) {
      return {
        id: match.id,
        email: match.email ?? undefined,
        email_confirmed_at: match.email_confirmed_at,
        user_metadata: (match.user_metadata ?? {}) as Record<string, unknown>,
      };
    }
    if (data.users.length < 200) return null;
  }
  return null;
}
