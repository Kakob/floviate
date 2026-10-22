-- Scenes are a presentation concern: the app's registry decides which keys exist and
-- falls back to the quiet room for unknown ones. The database only checks the key's shape,
-- so adding a scene no longer needs a migration.
ALTER TABLE public.day_blocks DROP CONSTRAINT day_blocks_scene_check;
ALTER TABLE public.day_blocks ADD CONSTRAINT day_blocks_scene_key CHECK (scene ~ '^[a-z][a-z_]{0,39}$');
