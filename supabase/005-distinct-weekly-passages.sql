-- 005-distinct-weekly-passages.sql
--
-- Fixes: both partners receiving the SAME Sunday passage.
--
-- Cause (see ensure_current_week in 002-bootstrap.sql): the loop counter `i` and
-- the duplicate-detection array `used` are local variables initialised on every
-- call. The function runs once per sign-in, so in practice it creates Sam's row
-- in one call and Sammy's row in a LATER call:
--
--   call 1 (Sam only)     i = 1, used = {}  -> pick f(1)
--   call 2 (Sammy signs in) i = 1, used = {}  -> pick f(1)   <-- same passage
--
-- The `used` array only ever deduplicated partners created inside a single
-- invocation, which for two people who register separately is never the case.
--
-- Fix: seed `used` and the counter from the assignments that already exist for
-- this household and cycle, so a partner created later is pushed onto a
-- different reference.
--
-- The daily encouragement is deliberately NOT changed: `ensure_today_daily`
-- creates one row per day for the whole household, which is why both partners
-- share today's verse. Only the Sunday passages must differ.
--
-- Run this file in the Supabase SQL editor after 002 and 004.

create or replace function public.ensure_current_week()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  monday        date := date_trunc('week', (now() at time zone 'utc'))::date;
  cid           text := to_char(date_trunc('week', (now() at time zone 'utc')),
                                'IYYY-"W"IW');
  partner       record;
  refs          text[] := array['Psalm 23:1-6', 'Philippians 4:6-7', 'Proverbs 3:5-6',
                                'Isaiah 40:28-31', '1 Corinthians 13:4-7', 'Hebrews 11:1-3',
                                'Joshua 1:7-9', 'Psalm 100:1-5', 'James 1:2-4',
                                'Colossians 3:12-14', 'Romans 15:4-6', 'Psalm 27:1-5'];
  themes        text[] := array['Faith', 'Peace', 'Wisdom', 'Patience', 'Love', 'Faith',
                                'Courage', 'Gratitude', 'Perseverance', 'Forgiveness', 'Hope', 'Courage'];
  ordinal       int := 0;
  pick          int;
  used          int[] := '{}';
  focus         text;
  body          text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'No profile for the signed-in user';
  end if;

  insert into public.weekly_cycles (id, week_start, selection_at, generated_at, origin)
  values (cid, monday, monday + interval '10 hours', now(), 'preview-simulation')
  on conflict (id) do nothing;

  -- Seed from what this household already has this cycle. This is the fix: a
  -- partner who signs in later must not collide with a passage already assigned.
  select coalesce(array_agg(t.idx), '{}'::int[]), count(*)
    into used, ordinal
    from (
      select array_position(refs, a.reference) as idx
      from public.weekly_assignments a
      join public.profiles p2 on p2.id = a.user_id
      where a.cycle_id = cid
        and p2.household_id = public.current_household_id()
    ) t
   where t.idx is not null;

  for partner in
    select p.id, p.email from public.profiles p
    where p.household_id = public.current_household_id()
    order by p.slot
  loop
    if exists (select 1 from public.weekly_assignments a
               where a.cycle_id = cid and a.user_id = partner.id) then
      continue;
    end if;

    ordinal := ordinal + 1;
    pick := ((abs(hashtext(cid)) + ordinal * 5) % array_length(refs, 1)) + 1;
    while pick = any(used) loop
      pick := (pick % array_length(refs, 1)) + 1;
    end loop;
    used := array_append(used, pick);

    focus := themes[pick];
    body := format(E'Preview placeholder — not Scripture text.\n\nThe New Living Translation text of %s is not included in this build. No licensed NLT provider is connected yet, and the app deliberately shows no substitute translation.\n\nOnce a verified NLT provider is configured, the full passage will appear here and the translation badge will change from “Preview” to “NLT”.', refs[pick]);

    insert into public.weekly_assignments
      (cycle_id, user_id, reference, translation, passage_text, attribution,
       provider_id, content_kind, theme, email_status, email_recipient, email_detail)
    values
      (cid, partner.id, refs[pick], 'NLT', body,
       'No NLT text reproduced. New Living Translation copyright © Tyndale House Publishers. Display and redistribution require a licence.',
       'preview', 'placeholder', focus, 'queued', partner.email,
       'Email service not configured yet — queued, not sent.')
    on conflict do nothing;
  end loop;

  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- OPTIONAL one-time repair
--
-- Only needed if the two partners ALREADY hold the same reference this week.
-- It touches exclusively rows that have not been emailed yet
-- (email_status = 'queued'), so no delivered message is ever rewritten.
-- The reassigned row keeps placeholder text; the next `prepare` call upgrades it
-- to licensed NLT.
-- ---------------------------------------------------------------------------
with refpool(ref, theme) as (
  values ('Psalm 23:1-6','Faith'), ('Philippians 4:6-7','Peace'), ('Proverbs 3:5-6','Wisdom'),
         ('Isaiah 40:28-31','Patience'), ('1 Corinthians 13:4-7','Love'), ('Hebrews 11:1-3','Faith'),
         ('Joshua 1:7-9','Courage'), ('Psalm 100:1-5','Gratitude'), ('James 1:2-4','Perseverance'),
         ('Colossians 3:12-14','Forgiveness'), ('Romans 15:4-6','Hope'), ('Psalm 27:1-5','Courage')
),
dupes as (
  select a.id as assignment_id, p.household_id, a.cycle_id,
         row_number() over (
           partition by p.household_id, a.cycle_id, a.reference
           order by p.slot
         ) as rn
  from public.weekly_assignments a
  join public.profiles p on p.id = a.user_id
  where a.email_status = 'queued'
)
update public.weekly_assignments a
set reference    = pick.ref,
    theme        = pick.theme,
    passage_text = format(
      E'Preview placeholder — not Scripture text.\n\nThe New Living Translation text of %s is not included in this build.\n\nOnce a verified NLT provider is configured, the full passage will appear here.',
      pick.ref
    ),
    attribution  = 'No NLT text reproduced. New Living Translation copyright © Tyndale House Publishers. Display and redistribution require a licence.',
    provider_id  = 'preview',
    content_kind = 'placeholder',
    email_detail = 'Reassigned so each partner has a different passage — queued, not sent.'
from dupes d
cross join lateral (
  select r.ref, r.theme
  from refpool r
  where r.ref not in (
    select a2.reference
    from public.weekly_assignments a2
    join public.profiles p2 on p2.id = a2.user_id
    where a2.cycle_id = d.cycle_id
      and p2.household_id = d.household_id
  )
  order by r.ref
  limit 1
) pick
where d.rn > 1
  and a.id = d.assignment_id;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- One row per partner, and no repeated reference within the household:
--
--   select p.slot, a.reference, a.theme, a.content_kind, a.email_status
--     from public.weekly_assignments a
--     join public.profiles p on p.id = a.user_id
--    where a.cycle_id = to_char(date_trunc('week', (now() at time zone 'utc')), 'IYYY-"W"IW')
--    order by p.slot;
--
-- Expect two distinct references. Then run `prepare` to upgrade both rows to
-- licensed NLT:
--
--   curl -X POST ".../functions/v1/send-email" \
--        -H "x-cron-secret: <secret>" -d '{"mode":"prepare"}'
