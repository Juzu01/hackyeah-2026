-- Data for charts and trends. Both run as the caller (security invoker), so RLS limits them
-- to the signed-in user's own reports.

-- One row per user, day (Polish time) and body part: series for "pain over time" charts.
create view public.pain_daily with (security_invoker = true) as
select
  r.user_id,
  (r.reported_at at time zone 'Europe/Warsaw')::date as day,
  r.body_part_id,
  count(*)::integer                as reports,
  round(avg(r.intensity), 1)       as avg_intensity,
  max(r.intensity)::integer        as max_intensity
from public.pain_reports r
group by r.user_id, day, r.body_part_id;

-- Supabase's default privileges would grant ALL on the view to anon as well; only signed-in users read it.
revoke all on public.pain_daily from anon, authenticated;
grant select on public.pain_daily to authenticated;

-- Last p_days vs the p_days before, per body part. trend:
--   'up'   average rose by at least 1 point     'down' fell by at least 1 point
--   'flat' changed by less than 1               'new'  only in the recent window
--   'gone' only in the earlier window (no recent reports)
create function public.pain_trend(p_days integer default 7)
returns table (
  body_part_id     text,
  name_pl          text,
  recent_avg       numeric,
  previous_avg     numeric,
  recent_reports   integer,
  previous_reports integer,
  trend            text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with windowed as (
    select r.body_part_id,
           r.intensity,
           r.reported_at >= now() - make_interval(days => p_days) as recent
    from public.pain_reports r
    where r.user_id = (select auth.uid())
      and r.reported_at >= now() - make_interval(days => 2 * p_days)
      and r.reported_at <= now()
  ), agg as (
    select w.body_part_id,
           round(avg(w.intensity) filter (where w.recent), 1)     as recent_avg,
           round(avg(w.intensity) filter (where not w.recent), 1) as previous_avg,
           (count(*) filter (where w.recent))::integer            as recent_reports,
           (count(*) filter (where not w.recent))::integer        as previous_reports
    from windowed w
    group by w.body_part_id
  )
  select a.body_part_id,
         bp.name_pl,
         a.recent_avg,
         a.previous_avg,
         a.recent_reports,
         a.previous_reports,
         case
           when a.recent_reports = 0 then 'gone'
           when a.previous_reports = 0 then 'new'
           when a.recent_avg - a.previous_avg >= 1 then 'up'
           when a.previous_avg - a.recent_avg >= 1 then 'down'
           else 'flat'
         end
  from agg a
  left join public.body_parts bp on bp.id = a.body_part_id
  where p_days between 1 and 365
  order by a.recent_avg desc nulls last, a.previous_avg desc;
$$;

revoke execute on function public.pain_trend(integer) from public, anon;
grant execute on function public.pain_trend(integer) to authenticated;
