-- Supabase's default privileges grant ALL on new public tables to anon and authenticated
-- (incl. TRUNCATE, which ignores RLS), so the grants in the schema migration were no-ops.
-- Reset to exactly what the app needs; RLS still decides which rows are visible.

revoke all on public.body_parts, public.pain_types, public.pain_reports, public.pain_report_types
  from anon, authenticated;

grant select on public.body_parts, public.pain_types to anon, authenticated;

grant select, insert, delete on public.pain_reports to authenticated;
grant update (body_part_id, intensity, note, reported_at) on public.pain_reports to authenticated;

grant select, insert, delete on public.pain_report_types to authenticated;
