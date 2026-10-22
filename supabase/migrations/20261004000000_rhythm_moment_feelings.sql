-- One entry can now carry a feeling and a note for each moment: before, during, and after.
-- Replaces the single feeling + moment + note. Existing entries keep what they said: a feeling
-- and note move to the moment they were tagged with, and untagged ones move to "after",
-- since a tap is usually logged once the thing has happened.
BEGIN;

ALTER TABLE public.rhythm_entries
  ADD COLUMN feeling_before smallint CHECK (feeling_before BETWEEN 1 AND 5),
  ADD COLUMN feeling_during smallint CHECK (feeling_during BETWEEN 1 AND 5),
  ADD COLUMN feeling_after smallint CHECK (feeling_after BETWEEN 1 AND 5),
  ADD COLUMN note_before text NOT NULL DEFAULT '' CHECK (length(note_before) <= 2000),
  ADD COLUMN note_during text NOT NULL DEFAULT '' CHECK (length(note_during) <= 2000),
  ADD COLUMN note_after text NOT NULL DEFAULT '' CHECK (length(note_after) <= 2000);

UPDATE public.rhythm_entries SET
  feeling_before = CASE WHEN moment = 'before' THEN feeling END,
  feeling_during = CASE WHEN moment = 'during' THEN feeling END,
  feeling_after = CASE WHEN moment = 'after' OR moment IS NULL THEN feeling END,
  note_before = CASE WHEN moment = 'before' THEN note ELSE '' END,
  note_during = CASE WHEN moment = 'during' THEN note ELSE '' END,
  note_after = CASE WHEN moment = 'after' OR moment IS NULL THEN note ELSE '' END;

ALTER TABLE public.rhythm_entries DROP COLUMN feeling, DROP COLUMN moment, DROP COLUMN note;

COMMIT;
