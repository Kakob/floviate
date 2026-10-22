// @vitest-environment node
import { readFileSync } from 'fs'
import path from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

// Runs the real migration against in-memory Postgres, with minimal stand-ins for the
// Supabase auth schema and the pre-existing tables it depends on.
const MIGRATIONS = ['20260924000000_living_day_scenes.sql', '20260924120000_day_scene_keys.sql', '20260925000000_day_block_delete.sql'].map(file =>
  readFileSync(path.resolve(__dirname, '../../supabase/migrations', file), 'utf8')
)

const USER = '00000000-0000-0000-0000-000000000001'
const OTHER = '00000000-0000-0000-0000-000000000002'

const PRELUDE = `
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql AS
  $$ BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END; $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL);
CREATE TABLE public.focus_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL);
CREATE TABLE public.log_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL);
CREATE TABLE public.session_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL);
CREATE TABLE public.log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.focus_sessions(id) ON DELETE CASCADE,
  session_task_id uuid REFERENCES public.session_tasks(id) ON DELETE SET NULL,
  log_type_id uuid NOT NULL REFERENCES public.log_types(id) ON DELETE CASCADE,
  value_numeric numeric, value_text text, value_choice text,
  source text NOT NULL CHECK (source IN ('manual', 'reminder_prompt', 'session_end')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_select ON public.log_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_insert ON public.log_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE ROLE authenticated;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
INSERT INTO public.profiles VALUES ('${USER}'), ('${OTHER}');
`

let db: PGlite

/** Runs statements as a signed-in user, with RLS enforced. */
async function asUser<T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${userId}', false);`)
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('RESET ROLE;')
  }
}

async function createBlock(userId = USER, title = 'Writing') {
  const [row] = await asUser<{ id: string }>(
    userId,
    `INSERT INTO public.day_blocks (user_id, plan_date, title, scene) VALUES ($1, '2026-09-24', $2, 'writing') RETURNING id`,
    [userId, title]
  )
  return row.id
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(PRELUDE)
  for (const migration of MIGRATIONS) await db.exec(migration)
  await db.exec(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`)
})

describe('living day scenes migration', () => {
  it('records a thought without a focus session and snapshots the plan on the server', async () => {
    const blockId = await createBlock()
    const [entry] = await asUser<{ plan_snapshot: { title: string }; previous_plan: unknown }>(
      USER,
      `INSERT INTO public.log_entries (user_id, day_block_id, event_kind, source, value_text, plan_snapshot, previous_plan)
       VALUES ($1, $2, 'thought', 'manual', 'Stuck on the opening', '{"title":"forged"}', '{"title":"forged"}')
       RETURNING plan_snapshot, previous_plan`,
      [USER, blockId]
    )
    expect(entry.plan_snapshot.title).toBe('Writing')
    expect(entry.previous_plan).toBeNull()
  })

  it('records unplanned thoughts with no block', async () => {
    const rows = await asUser(
      USER,
      `INSERT INTO public.log_entries (user_id, event_kind, source, value_text) VALUES ($1, 'changed_activity', 'manual', 'I don''t know') RETURNING id`,
      [USER]
    )
    expect(rows).toHaveLength(1)
  })

  it('keeps plan history when the plan is edited, without rewriting earlier check-ins', async () => {
    const blockId = await createBlock(USER, 'Programming')
    await asUser(USER, `INSERT INTO public.log_entries (user_id, day_block_id, event_kind, source, value_text) VALUES ($1, $2, 'started', 'manual', 'Opened the editor')`, [USER, blockId])
    await asUser(USER, `UPDATE public.day_blocks SET title = 'Walk', scene = 'quiet' WHERE id = $1`, [blockId])

    const rows = await asUser<{ event_kind: string; plan_snapshot: { title: string }; previous_plan: { title: string } | null }>(
      USER,
      `SELECT event_kind, plan_snapshot, previous_plan FROM public.log_entries WHERE day_block_id = $1 ORDER BY created_at, event_kind`,
      [blockId]
    )
    const started = rows.find(r => r.event_kind === 'started')!
    const changed = rows.find(r => r.event_kind === 'plan_changed')!
    expect(started.plan_snapshot.title).toBe('Programming')
    expect(changed.plan_snapshot.title).toBe('Walk')
    expect(changed.previous_plan?.title).toBe('Programming')
  })

  it('records done and skipped as explicit events, and ignores reordering', async () => {
    const blockId = await createBlock(USER, 'Dinner')
    await asUser(USER, `UPDATE public.day_blocks SET position = 7 WHERE id = $1`, [blockId])
    await asUser(USER, `UPDATE public.day_blocks SET status = 'done' WHERE id = $1`, [blockId])
    await asUser(USER, `UPDATE public.day_blocks SET status = 'planned' WHERE id = $1`, [blockId])
    await asUser(USER, `UPDATE public.day_blocks SET status = 'skipped' WHERE id = $1`, [blockId])

    const rows = await asUser<{ event_kind: string }>(
      USER,
      `SELECT event_kind FROM public.log_entries WHERE day_block_id = $1 ORDER BY created_at`,
      [blockId]
    )
    expect(rows.map(r => r.event_kind)).toEqual(['finished', 'plan_changed', 'skipped'])
  })

  it('does not let clients forge plan history events', async () => {
    const blockId = await createBlock()
    await expect(
      asUser(USER, `INSERT INTO public.log_entries (user_id, day_block_id, event_kind, source, value_text) VALUES ($1, $2, 'finished', 'manual', 'fake')`, [USER, blockId])
    ).rejects.toThrow(/row-level security/)
  })

  it("does not let a user attach a check-in to someone else's block", async () => {
    const othersBlock = await createBlock(OTHER, 'Private')
    await expect(
      asUser(USER, `INSERT INTO public.log_entries (user_id, day_block_id, event_kind, source, value_text) VALUES ($1, $2, 'thought', 'manual', 'hi')`, [USER, othersBlock])
    ).rejects.toThrow()
  })

  it('still accepts existing focus-session logs', async () => {
    const [{ id: sessionId }] = (await db.query<{ id: string }>(`INSERT INTO public.focus_sessions (user_id) VALUES ('${USER}') RETURNING id`)).rows
    const [{ id: typeId }] = (await db.query<{ id: string }>(`INSERT INTO public.log_types (user_id) VALUES ('${USER}') RETURNING id`)).rows
    const rows = await asUser(
      USER,
      `INSERT INTO public.log_entries (user_id, session_id, log_type_id, source, value_numeric) VALUES ($1, $2, $3, 'manual', 4) RETURNING id`,
      [USER, sessionId, typeId]
    )
    expect(rows).toHaveLength(1)
  })

  it('rejects a log with neither a session nor a day event kind', async () => {
    await expect(
      asUser(USER, `INSERT INTO public.log_entries (user_id, source, value_text) VALUES ($1, 'manual', 'orphan')`, [USER])
    ).rejects.toThrow(/log_entries_context/)
  })

  it('requires both planned times or neither', async () => {
    await expect(
      asUser(USER, `INSERT INTO public.day_blocks (user_id, plan_date, title, planned_start) VALUES ($1, '2026-09-24', 'Half', now())`, [USER])
    ).rejects.toThrow(/check constraint/)
  })

  it('accepts any well-formed scene key and rejects malformed ones', async () => {
    const rows = await asUser(USER, `INSERT INTO public.day_blocks (user_id, plan_date, title, scene) VALUES ($1, '2026-09-24', 'Run', 'home_workout') RETURNING id`, [USER])
    expect(rows).toHaveLength(1)
    await expect(
      asUser(USER, `INSERT INTO public.day_blocks (user_id, plan_date, title, scene) VALUES ($1, '2026-09-24', 'Bad', 'Robert''); DROP')`, [USER])
    ).rejects.toThrow(/day_blocks_scene_key/)
  })
  it('removes an unused plan along with its plan history', async () => {
    const blockId = await createBlock(USER, 'Copied by mistake')
    await asUser(USER, `UPDATE public.day_blocks SET title = 'Still a mistake' WHERE id = $1`, [blockId])
    const deleted = await asUser(USER, `DELETE FROM public.day_blocks WHERE id = $1 RETURNING id`, [blockId])
    expect(deleted).toHaveLength(1)
    const history = await asUser(USER, `SELECT id FROM public.log_entries WHERE day_block_id = $1`, [blockId])
    expect(history).toHaveLength(0)
  })

  it('keeps a plan that has check-ins', async () => {
    const blockId = await createBlock(USER, 'Lived in')
    await asUser(USER, `INSERT INTO public.log_entries (user_id, day_block_id, event_kind, source, value_text) VALUES ($1, $2, 'thought', 'manual', 'here')`, [USER, blockId])
    const deleted = await asUser(USER, `DELETE FROM public.day_blocks WHERE id = $1 RETURNING id`, [blockId])
    expect(deleted).toHaveLength(0)
  })

  it("does not remove someone else's plan", async () => {
    const othersBlock = await createBlock(OTHER, 'Not yours')
    const deleted = await asUser(USER, `DELETE FROM public.day_blocks WHERE id = $1 RETURNING id`, [othersBlock])
    expect(deleted).toHaveLength(0)
  })
})
