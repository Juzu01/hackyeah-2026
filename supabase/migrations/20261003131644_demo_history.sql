-- Demo data for presentations: a fresh anonymous user starts with an empty history, so charts would be
-- empty. seed_demo_history() gives the signed-in user ~30 days of believable reports, covering every
-- pain_trend() outcome; clear_demo_history() removes them. Real analytics can filter on is_demo = false.

alter table public.pain_reports add column is_demo boolean not null default false;

create function public.seed_demo_history()
returns integer
language plpgsql
security invoker -- runs as the caller, so the rows belong to them and RLS applies
set search_path = ''
as $$
declare
  v_today   timestamp := date_trunc('day', now() at time zone 'Europe/Warsaw');
  v_report  uuid;
  v_count   integer := 0;
  e         record;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  -- Re-running replaces the demo, so dates stay relative to today.
  delete from public.pain_reports where user_id = (select auth.uid()) and is_demo;

  for e in
    select * from (values
      -- Runner's knee after a long run: fades over four weeks (trend 'down').
      (29, 19, 'vastusMedialis-left',   8, array['sharp', 'throbbing']),
      (28,  9, 'vastusMedialis-left',   7, array['sharp', 'throbbing']),
      (26, 20, 'vastusMedialis-left',   6, array['throbbing', 'aching']),
      (24,  8, 'vastusMedialis-left',   6, array['aching']),
      (22, 19, 'vastusMedialis-left',   5, array['aching', 'pressing']),
      (19, 18, 'vastusMedialis-left',   5, array['aching']),
      (16, 20, 'vastusMedialis-left',   4, array['aching']),
      (13, 19, 'vastusMedialis-left',   5, array['sharp', 'aching']),
      (11,  8, 'vastusMedialis-left',   4, array['aching']),
      ( 9, 19, 'vastusMedialis-left',   4, array['dull']),
      ( 6, 20, 'vastusMedialis-left',   3, array['dull']),
      ( 4, 18, 'vastusMedialis-left',   2, array['dull']),
      ( 2, 19, 'vastusMedialis-left',   2, array['dull']),
      -- Desk neck: builds up in the last week (trend 'up').
      (20, 17, 'trapezius-right',       3, array['pressing']),
      (17, 16, 'trapezius-right',       3, array['pressing', 'aching']),
      (13, 17, 'trapezius-right',       3, array['pressing']),
      (10, 16, 'trapezius-right',       4, array['pressing', 'aching']),
      ( 6, 15, 'trapezius-right',       5, array['pressing', 'radiating']),
      ( 5, 17, 'trapezius-right',       6, array['pressing', 'radiating']),
      ( 3, 16, 'trapezius-right',       6, array['pressing', 'aching']),
      ( 1, 14, 'trapezius-right',       7, array['pressing', 'radiating', 'throbbing']),
      -- Night calf cramps that stopped (trend 'gone').
      (27, 21, 'gastrocnemius-left',    6, array['cramping']),
      (21, 22, 'gastrocnemius-left',    5, array['cramping', 'tearing']),
      (12, 21, 'gastrocnemius-left',    4, array['cramping']),
      -- Shin splints after upping the mileage (trend 'new').
      ( 4, 19, 'tibialisAnterior-right', 4, array['stabbing']),
      ( 2, 20, 'tibialisAnterior-right', 5, array['stabbing', 'burning'])
    ) as t (days_ago, hour, body_part_id, intensity, types)
  loop
    insert into public.pain_reports (body_part_id, intensity, reported_at, is_demo)
    values (
      e.body_part_id,
      e.intensity,
      (v_today - make_interval(days => e.days_ago) + make_interval(hours => e.hour)) at time zone 'Europe/Warsaw',
      true
    )
    returning id into v_report;

    insert into public.pain_report_types (report_id, pain_type_id)
    select v_report, unnest(e.types);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create function public.clear_demo_history()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with deleted as (
    delete from public.pain_reports
    where user_id = (select auth.uid()) and is_demo
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke execute on function public.seed_demo_history() from public, anon;
revoke execute on function public.clear_demo_history() from public, anon;
grant execute on function public.seed_demo_history() to authenticated;
grant execute on function public.clear_demo_history() to authenticated;
