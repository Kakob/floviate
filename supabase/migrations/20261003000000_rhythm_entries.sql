-- Daily rhythm: one row per occurrence of something the user does (reading, smoking, ...),
-- or per urge they noticed and didn't act on. Feeling and note are optional and may be
-- added after the tap. Unlike plans and check-ins, a tap made by mistake can simply be deleted.
-- Which activities exist is the app's concern; the database only checks the key's shape.
BEGIN;

CREATE TABLE public.rhythm_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity text NOT NULL CHECK (activity ~ '^[a-z][a-z_]{0,39}$'),
  kind text NOT NULL DEFAULT 'did' CHECK (kind IN ('did', 'urge')),
  feeling smallint CHECK (feeling BETWEEN 1 AND 5),
  moment text CHECK (moment IN ('before', 'during', 'after')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rhythm_entries_user_time ON public.rhythm_entries(user_id, occurred_at);

ALTER TABLE public.rhythm_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY rhythm_entries_select ON public.rhythm_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY rhythm_entries_insert ON public.rhythm_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY rhythm_entries_update ON public.rhythm_entries FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY rhythm_entries_delete ON public.rhythm_entries FOR DELETE USING (user_id = auth.uid());

COMMIT;
