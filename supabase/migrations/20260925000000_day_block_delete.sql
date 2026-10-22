-- Planning many days at once makes mistakes easy (a week copied twice). A plan may be removed
-- only while nothing was recorded against it; once it has a check-in it can only be skipped.
-- Removing a plan also removes its plan-change history, which described only that plan.
BEGIN;
ALTER TABLE public.log_entries DROP CONSTRAINT log_entries_day_block_id_fkey;
ALTER TABLE public.log_entries ADD CONSTRAINT log_entries_day_block_id_fkey
  FOREIGN KEY (day_block_id) REFERENCES public.day_blocks(id) ON DELETE CASCADE;

CREATE POLICY day_blocks_delete ON public.day_blocks FOR DELETE USING (
  user_id = auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.log_entries l
    WHERE l.day_block_id = day_blocks.id AND l.event_kind IN ('thought', 'started', 'changed_activity')
  )
);
COMMIT;
