-- Rhythm sessions: a tap can become a session that runs until it is stopped.
-- ended_at = occurred_at is a moment (every existing tap), NULL is live, later is a finished session.
-- A tap always starts as a moment; "Start session" clears ended_at.
-- variant picks a sub-option of an activity (writing → journal, coding → vibecode); the app owns the keys.
-- A session ends with what got done: a note and tally rows ([{label, value, unit}]).
-- Marks are timestamped notes (and an optional 1-5 level) added while a session runs, e.g. the
-- intensity of each pang in a craving wave.
BEGIN;

ALTER TABLE public.rhythm_entries
  ADD COLUMN ended_at timestamptz,
  ADD COLUMN variant text CHECK (variant ~ '^[a-z][a-z_]{0,39}$'),
  ADD COLUMN done_note text NOT NULL DEFAULT '' CHECK (length(done_note) <= 2000),
  ADD COLUMN tallies jsonb NOT NULL DEFAULT '[]'
    CHECK (jsonb_typeof(tallies) = 'array' AND jsonb_array_length(tallies) <= 30);

UPDATE public.rhythm_entries SET ended_at = occurred_at;

-- Every tap is inserted as a moment; it becomes a live session only by a later update.
-- This keeps taps from older clients (which don't send ended_at) from starting sessions.
CREATE FUNCTION public.rhythm_entry_default_end() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ended_at IS NULL THEN NEW.ended_at := NEW.occurred_at; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rhythm_entry_default_end BEFORE INSERT ON public.rhythm_entries
  FOR EACH ROW EXECUTE FUNCTION public.rhythm_entry_default_end();

ALTER TABLE public.rhythm_entries
  ADD CONSTRAINT rhythm_entries_span CHECK (
    ended_at IS NULL OR (ended_at >= occurred_at AND ended_at - occurred_at <= interval '24 hours')
  );

CREATE INDEX rhythm_entries_live ON public.rhythm_entries(user_id) WHERE ended_at IS NULL;

CREATE TABLE public.rhythm_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.rhythm_entries(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  level smallint CHECK (level BETWEEN 1 AND 5),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rhythm_marks_entry_time ON public.rhythm_marks(entry_id, at);

ALTER TABLE public.rhythm_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY rhythm_marks_select ON public.rhythm_marks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY rhythm_marks_insert ON public.rhythm_marks FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.rhythm_entries e WHERE e.id = entry_id AND e.user_id = auth.uid())
);
CREATE POLICY rhythm_marks_update ON public.rhythm_marks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY rhythm_marks_delete ON public.rhythm_marks FOR DELETE USING (user_id = auth.uid());

COMMIT;
