-- ---------------------------------------------------------------------------
-- 003 — Today's daily passage + scheduled email runs
--
-- Run in the Supabase SQL editor after schema.sql and 002-bootstrap.sql.
-- Replace <PROJECT_REF> and <EDGE_CRON_SECRET> before running (the secret must
-- match the CRON_SECRET set for the edge function).
-- ---------------------------------------------------------------------------

-- 1. Daily encouragement, created once per day -------------------------------
create or replace function public.ensure_today_daily()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  today    date := (now() at time zone 'utc')::date;
  refs     text[] := array['Psalm 42:11','Romans 15:13','Proverbs 3:5-6','James 1:5',
                           'Hebrews 11:1','Joshua 1:9','Isaiah 41:10','Psalm 27:14',
                           '1 Thessalonians 5:18','Psalm 4:8','John 14:27','Romans 5:3-5',
                           'Colossians 3:13','Psalm 103:11-12'];
  themes   text[] := array['Hope','Hope','Wisdom','Wisdom','Faith','Courage','Courage',
                           'Patience','Gratitude','Peace','Peace','Perseverance',
                           'Forgiveness','Forgiveness'];
  pick     int := ((abs(hashtext(today::text)) % array_length(refs, 1)) + 1);
  body     text;
begin
  if exists (select 1 from public.daily_scriptures where day = today) then
    return today::text;
  end if;

  body := format(E'Preview placeholder — not Scripture text.\n\nThe New Living Translation text of %s is not included in this build. No licensed NLT provider is connected yet, and the app deliberately shows no substitute translation.\n\nOnce a verified NLT provider is configured, the full passage will appear here.', refs[pick]);

  insert into public.daily_scriptures
    (day, reference, translation, passage_text, attribution, provider_id, content_kind, theme)
  values
    (today, refs[pick], 'NLT', body,
     'No NLT text reproduced. New Living Translation copyright © Tyndale House Publishers.',
     'preview', 'placeholder', themes[pick])
  on conflict (day) do nothing;

  return today::text;
end;
$$;

grant execute on function public.ensure_today_daily() to authenticated;

-- 2. Schedules ---------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Monday 10:00 UTC — weekly Scripture email
select cron.schedule(
  'weekly-scripture-email',
  '0 10 * * 1',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<EDGE_CRON_SECRET>'
    ),
    body    := '{"mode":"weekly"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- 08:00 SAST (06:00 UTC) — daily encouragement
select cron.schedule(
  'daily-encouragement-email',
  '0 6 * * *',
  $$
  select public.ensure_today_daily();
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<EDGE_CRON_SECRET>'
    ),
    body    := '{"mode":"daily"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Inspect runs later:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select * from public.email_deliveries order by created_at desc limit 20;
