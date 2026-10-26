-- 004-fix-cron-secret.sql
--
-- Repairs the scheduled email path.
--
-- Symptom: `003-email-and-cron.sql` deployed the cron runner functions with the
-- header `x-cron-secret: 'blank'` while the `send-email` function requires the
-- real CRON_SECRET. Every scheduled invocation therefore returned 401, so no
-- weekly or daily email was ever delivered automatically — delivery only worked
-- when triggered by hand.
--
-- This file keeps the secret OUT of version control. It is stored once in
-- `app_config`, which has row level security enabled and no policies, so the
-- anon/authenticated roles cannot read it; only the SECURITY DEFINER runners
-- below (and the service role) can.
--
-- RUN ORDER
--   1. Run this whole file in the Supabase SQL editor.
--   2. Then set the real secret, replacing the placeholder below with the value
--      of the CRON_SECRET function secret:
--
--        insert into public.app_config (key, value)
--        values ('cron_secret', 'REPLACE_WITH_REAL_CRON_SECRET')
--        on conflict (key) do update set value = excluded.value;
--
--   3. Verify the schedule and one manual run (see the queries at the bottom).

-- 1. Config table ------------------------------------------------------------
create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- Deliberately no policies: nothing in the browser can read this table.
revoke all on table public.app_config from anon, authenticated;

-- 2. Runners that use the stored secret --------------------------------------
create or replace function public.run_weekly_email()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select value into secret from public.app_config where key = 'cron_secret';
  if secret is null or secret = '' then
    raise exception 'cron_secret is not configured in public.app_config';
  end if;

  return net.http_post(
    url := 'https://iihmeoccxvjfvnwcuanq.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secret
    ),
    body := '{"mode":"weekly"}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

create or replace function public.run_daily_email()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select value into secret from public.app_config where key = 'cron_secret';
  if secret is null or secret = '' then
    raise exception 'cron_secret is not configured in public.app_config';
  end if;

  perform public.ensure_today_daily();

  return net.http_post(
    url := 'https://iihmeoccxvjfvnwcuanq.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secret
    ),
    body := '{"mode":"daily"}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.run_weekly_email() from anon, authenticated;
revoke all on function public.run_daily_email() from anon, authenticated;

-- 3. Ensure the schedules exist (idempotent) ---------------------------------
select cron.unschedule('weekly-scripture-email')
where exists (select 1 from cron.job where jobname = 'weekly-scripture-email');

select cron.schedule('weekly-scripture-email', '0 10 * * 1',
                     'select public.run_weekly_email();');

select cron.unschedule('daily-encouragement-email')
where exists (select 1 from cron.job where jobname = 'daily-encouragement-email');

select cron.schedule('daily-encouragement-email', '0 6 * * *',
                     'select public.run_daily_email();');

-- 4. Verification ------------------------------------------------------------
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
--   -- A scheduled run that 401'd shows status 'failed'.
--   select id, kind, status, detail, created_at
--     from public.email_deliveries order by created_at desc limit 10;
