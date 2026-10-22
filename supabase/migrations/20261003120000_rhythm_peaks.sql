-- All-time busiest day per activity and kind, counted in the caller's local time zone.
-- Computed here so the app needn't download every entry ever made. SECURITY INVOKER: RLS applies,
-- and the explicit user filter keeps the plan cheap. Ties go to the most recent day.
CREATE FUNCTION public.rhythm_peaks(tz text)
RETURNS TABLE (activity text, kind text, peak integer, peak_date date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT DISTINCT ON (d.activity, d.kind) d.activity, d.kind, count(*)::int, d.day
  FROM (
    SELECT e.activity, e.kind, (e.occurred_at AT TIME ZONE tz)::date AS day
    FROM public.rhythm_entries e
    WHERE e.user_id = auth.uid()
  ) d
  GROUP BY d.activity, d.kind, d.day
  ORDER BY d.activity, d.kind, count(*) DESC, d.day DESC
$$;

GRANT EXECUTE ON FUNCTION public.rhythm_peaks(text) TO authenticated;
