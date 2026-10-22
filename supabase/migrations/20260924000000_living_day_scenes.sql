-- Living Day Scenes: planned parts of a day, and check-ins recorded against them.
-- A day block is intention, not a task and not a record of completed work.
-- Check-ins extend the existing log_entries journal rather than adding a second logging system.
BEGIN;

-- =============================================================================
-- DAY BLOCKS (the plan)
-- =============================================================================
-- Order is primary; clock times are optional soft anchors.
-- status only becomes 'done' when the user says so; elapsed time never changes it.
CREATE TABLE public.day_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  plan_date date NOT NULL,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  intention text NOT NULL DEFAULT '' CHECK (length(intention) <= 4000),
  planned_start timestamptz,
  planned_end timestamptz,
  scene text NOT NULL DEFAULT 'quiet' CHECK (scene IN ('writing', 'computer', 'reading', 'quiet')),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'skipped', 'done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((planned_start IS NULL) = (planned_end IS NULL)),
  CHECK (planned_start IS NULL OR (planned_end > planned_start AND planned_end <= planned_start + interval '24 hours'))
);
CREATE INDEX day_blocks_user_date ON public.day_blocks(user_id, plan_date, position);

ALTER TABLE public.day_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY day_blocks_select ON public.day_blocks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY day_blocks_insert ON public.day_blocks FOR INSERT WITH CHECK (
  user_id = auth.uid() AND (item_id IS NULL OR EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid()))
);
CREATE POLICY day_blocks_update ON public.day_blocks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (
  user_id = auth.uid() AND (item_id IS NULL OR EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND user_id = auth.uid()))
);
-- No DELETE policy: skipping keeps history intact.

CREATE TRIGGER day_blocks_updated_at BEFORE UPDATE ON public.day_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- LOG ENTRIES (extended into a general check-in journal)
-- =============================================================================
-- A thought no longer requires a focus session.
ALTER TABLE public.log_entries ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE public.log_entries ALTER COLUMN log_type_id DROP NOT NULL;
ALTER TABLE public.log_entries
  ADD COLUMN day_block_id uuid REFERENCES public.day_blocks(id),
  ADD COLUMN event_kind text CHECK (event_kind IN ('thought', 'started', 'changed_activity', 'plan_changed', 'finished', 'skipped')),
  ADD COLUMN plan_snapshot jsonb,
  ADD COLUMN previous_plan jsonb;
-- Session logs keep their original shape; day check-ins are identified by event_kind.
ALTER TABLE public.log_entries ADD CONSTRAINT log_entries_context CHECK (
  (session_id IS NOT NULL AND log_type_id IS NOT NULL) OR event_kind IS NOT NULL
);
CREATE INDEX log_entries_day_block ON public.log_entries(day_block_id, created_at);
CREATE INDEX log_entries_day_events ON public.log_entries(user_id, created_at) WHERE event_kind IS NOT NULL;

-- Restrictive: augments the original ownership policy for every insert, including session logs.
-- Clients may only record what they observed; plan history is written by the audit trigger.
CREATE POLICY log_entries_owned_links ON public.log_entries AS RESTRICTIVE FOR INSERT WITH CHECK (
  (event_kind IS NULL OR event_kind IN ('thought', 'started', 'changed_activity')) AND
  (day_block_id IS NULL OR EXISTS (SELECT 1 FROM public.day_blocks b WHERE b.id = day_block_id AND b.user_id = auth.uid())) AND
  (session_id IS NULL OR EXISTS (SELECT 1 FROM public.focus_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())) AND
  (log_type_id IS NULL OR EXISTS (SELECT 1 FROM public.log_types t WHERE t.id = log_type_id AND t.user_id = auth.uid())) AND
  (session_task_id IS NULL OR EXISTS (SELECT 1 FROM public.session_tasks t WHERE t.id = session_task_id AND t.session_id = log_entries.session_id))
);

-- Capture the plan as it was at check-in time, on the server rather than from a possibly stale browser.
CREATE FUNCTION public.snapshot_day_check_in() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.event_kind IN ('thought', 'started', 'changed_activity') THEN
    NEW.previous_plan := NULL;
    NEW.plan_snapshot := NULL;
    IF NEW.day_block_id IS NOT NULL THEN
      SELECT to_jsonb(b) INTO NEW.plan_snapshot FROM public.day_blocks b
        WHERE b.id = NEW.day_block_id AND b.user_id = NEW.user_id;
      IF NEW.plan_snapshot IS NULL THEN RAISE EXCEPTION 'Day block not found'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER snapshot_day_check_in BEFORE INSERT ON public.log_entries
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_day_check_in();

-- Plan edits and their history commit atomically. Reordering alone is not recorded.
-- SECURITY DEFINER so it may write the server-only event kinds the client policy forbids.
CREATE FUNCTION public.audit_day_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  kind text;
  label text;
BEGIN
  IF (OLD.title, OLD.intention, OLD.planned_start, OLD.planned_end, OLD.scene, OLD.item_id, OLD.plan_date)
    IS DISTINCT FROM (NEW.title, NEW.intention, NEW.planned_start, NEW.planned_end, NEW.scene, NEW.item_id, NEW.plan_date) THEN
    kind := 'plan_changed'; label := 'Plan changed';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    kind := CASE NEW.status WHEN 'done' THEN 'finished' WHEN 'skipped' THEN 'skipped' ELSE 'plan_changed' END;
    label := CASE NEW.status WHEN 'done' THEN 'Said I was done' WHEN 'skipped' THEN 'Skipped' ELSE 'Restored the plan' END;
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.log_entries(user_id, day_block_id, event_kind, source, value_text, plan_snapshot, previous_plan)
  VALUES (NEW.user_id, NEW.id, kind, 'manual', label, to_jsonb(NEW), to_jsonb(OLD));
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_day_block AFTER UPDATE ON public.day_blocks
  FOR EACH ROW EXECUTE FUNCTION public.audit_day_block();

COMMIT;
