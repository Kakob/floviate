// @vitest-environment node
import { readFileSync } from 'fs'
import path from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const BASE = ['20261003000000_rhythm_entries.sql', '20261003120000_rhythm_peaks.sql']
const MOMENT_FEELINGS = '20261004000000_rhythm_moment_feelings.sql'
const SESSIONS = '20261005000000_rhythm_sessions.sql'
const MIGRATIONS = BASE.map(file =>
  readFileSync(path.resolve(__dirname, '../../supabase/migrations', file), 'utf8')
)
const USER = '00000000-0000-0000-0000-000000000001'
const OTHER = '00000000-0000-0000-0000-000000000002'

let db: PGlite

async function asUser<T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${userId}', false);`)
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('RESET ROLE;')
  }
}

const tap = (userId: string, activity = 'smoking', kind = 'did') =>
  asUser<{ id: string }>(userId, `INSERT INTO public.rhythm_entries (user_id, activity, kind) VALUES ($1, $2, $3) RETURNING id`, [userId, activity, kind])

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY);
    INSERT INTO public.profiles VALUES ('${USER}'), ('${OTHER}');
    CREATE ROLE authenticated;
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
  `)
  for (const migration of MIGRATIONS) await db.exec(migration)
  // Entries made under the single feeling + moment + note shape, to check they carry over.
  await db.exec(`INSERT INTO public.rhythm_entries (id, user_id, activity, feeling, moment, note) VALUES
    ('10000000-0000-0000-0000-000000000001', '${USER}', 'smoking', 2, 'before', 'stressed'),
    ('10000000-0000-0000-0000-000000000002', '${USER}', 'reading', 4, NULL, 'lovely'),
    ('10000000-0000-0000-0000-000000000003', '${USER}', 'music', NULL, NULL, '')`)
  await db.exec(readFileSync(path.resolve(__dirname, '../../supabase/migrations', MOMENT_FEELINGS), 'utf8'))
  await db.exec(readFileSync(path.resolve(__dirname, '../../supabase/migrations', SESSIONS), 'utf8'))
  await db.exec(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`)
})

describe('rhythm entries migration', () => {
  it('moves earlier single feelings and notes to their moment, untagged ones to after', async () => {
    const rows = await asUser(USER, `SELECT feeling_before, feeling_during, feeling_after, note_before, note_during, note_after
      FROM public.rhythm_entries WHERE id::text LIKE '10000000%' ORDER BY id`)
    expect(rows).toEqual([
      { feeling_before: 2, feeling_during: null, feeling_after: null, note_before: 'stressed', note_during: '', note_after: '' },
      { feeling_before: null, feeling_during: null, feeling_after: 4, note_before: '', note_during: '', note_after: 'lovely' },
      { feeling_before: null, feeling_during: null, feeling_after: null, note_before: '', note_during: '', note_after: '' },
    ])
  })

  it('records a bare tap, then feelings for every moment afterwards', async () => {
    const [{ id }] = await tap(USER)
    await asUser(USER, `UPDATE public.rhythm_entries SET feeling_before = 2, note_before = 'stressed', feeling_during = 3,
      feeling_after = 4, note_after = 'calmer' WHERE id = $1`, [id])
    const [row] = await asUser(USER, `SELECT feeling_before, feeling_during, feeling_after, note_after FROM public.rhythm_entries WHERE id = $1`, [id])
    expect(row).toEqual({ feeling_before: 2, feeling_during: 3, feeling_after: 4, note_after: 'calmer' })
  })

  it('records urges', async () => {
    expect(await tap(USER, 'smoking', 'urge')).toHaveLength(1)
  })

  it('rejects bad feelings, kinds, and activity keys', async () => {
    const [{ id }] = await tap(USER)
    await expect(asUser(USER, `UPDATE public.rhythm_entries SET feeling_during = 6 WHERE id = $1`, [id])).rejects.toThrow(/check constraint/)
    await expect(tap(USER, 'smoking', 'maybe')).rejects.toThrow(/check constraint/)
    await expect(tap(USER, 'Bad Key')).rejects.toThrow(/check constraint/)
  })

  it("keeps each user's entries private", async () => {
    const [{ id }] = await tap(OTHER, 'reading')
    expect(await asUser(USER, `SELECT id FROM public.rhythm_entries WHERE id = $1`, [id])).toHaveLength(0)
    expect(await asUser(USER, `UPDATE public.rhythm_entries SET feeling_after = 1 WHERE id = $1 RETURNING id`, [id])).toHaveLength(0)
    expect(await asUser(USER, `DELETE FROM public.rhythm_entries WHERE id = $1 RETURNING id`, [id])).toHaveLength(0)
    await expect(asUser(USER, `INSERT INTO public.rhythm_entries (user_id, activity) VALUES ($1, 'reading')`, [OTHER])).rejects.toThrow(/row-level security/)
  })

  it('finds the all-time busiest day per activity in the given time zone, for the caller only', async () => {
    const at = (iso: string, userId = USER, activity = 'music') =>
      asUser(userId, `INSERT INTO public.rhythm_entries (user_id, activity, occurred_at) VALUES ($1, $2, $3)`, [userId, activity, iso])
    // 03:00Z on Jun 2 is still Jun 1 in Chicago.
    await at('2025-06-01T15:00:00Z')
    await at('2025-06-02T03:00:00Z')
    await at('2025-06-02T15:00:00Z')
    for (let i = 0; i < 5; i++) await at('2025-06-01T15:00:00Z', OTHER)

    const peaks = await asUser<{ activity: string; kind: string; peak: number; peak_date: unknown }>(
      USER,
      `SELECT activity, kind, peak, peak_date::text FROM public.rhythm_peaks('America/Chicago') WHERE activity = 'music'`
    )
    expect(peaks).toEqual([{ activity: 'music', kind: 'did', peak: 2, peak_date: '2025-06-01' }])

    const utc = await asUser<{ peak: number; peak_date: string }>(USER, `SELECT peak, peak_date::text FROM public.rhythm_peaks('UTC') WHERE activity = 'music'`)
    expect(utc).toEqual([{ peak: 2, peak_date: '2025-06-02' }])
  })

  it('lets a mistaken tap be removed', async () => {
    const [{ id }] = await tap(USER, 'art')
    expect(await asUser(USER, `DELETE FROM public.rhythm_entries WHERE id = $1 RETURNING id`, [id])).toHaveLength(1)
  })
})

describe('rhythm sessions migration', () => {
  const span = (id: string) =>
    asUser<{ moment: boolean; live: boolean }>(USER, `SELECT ended_at IS NOT DISTINCT FROM occurred_at AS moment, ended_at IS NULL AS live FROM public.rhythm_entries WHERE id = $1`, [id])

  it('keeps earlier taps as moments', async () => {
    const rows = await asUser(USER, `SELECT count(*)::int AS n FROM public.rhythm_entries
      WHERE id::text LIKE '10000000%' AND ended_at = occurred_at`)
    expect(rows).toEqual([{ n: 3 }])
  })

  it('inserts every tap as a moment, even when ended_at is left out', async () => {
    const [{ id }] = await tap(USER, 'writing')
    expect(await span(id)).toEqual([{ moment: true, live: false }])
  })

  it('starts a session from a tap, then stops it with what got done', async () => {
    const [{ id }] = await asUser<{ id: string }>(USER, `INSERT INTO public.rhythm_entries (user_id, activity, variant, occurred_at)
      VALUES ($1, 'exercise', 'gym', now() - interval '1 hour') RETURNING id`, [USER])
    await asUser(USER, `UPDATE public.rhythm_entries SET ended_at = NULL WHERE id = $1`, [id])
    expect(await span(id)).toEqual([{ moment: false, live: true }])
    await asUser(USER, `UPDATE public.rhythm_entries SET ended_at = now(), done_note = 'Push day',
      tallies = '[{"label":"Bench","value":135,"unit":"lb"}]' WHERE id = $1`, [id])
    const [row] = await asUser(USER, `SELECT variant, done_note, tallies FROM public.rhythm_entries WHERE id = $1`, [id])
    expect(row).toEqual({ variant: 'gym', done_note: 'Push day', tallies: [{ label: 'Bench', value: 135, unit: 'lb' }] })
  })

  it('rejects sessions that end before they start or run past a day, and bad variants or tallies', async () => {
    const [{ id }] = await tap(USER, 'coding')
    await expect(asUser(USER, `UPDATE public.rhythm_entries SET ended_at = occurred_at - interval '1 minute' WHERE id = $1`, [id])).rejects.toThrow(/check constraint/)
    await expect(asUser(USER, `UPDATE public.rhythm_entries SET ended_at = occurred_at + interval '25 hours' WHERE id = $1`, [id])).rejects.toThrow(/check constraint/)
    await expect(asUser(USER, `UPDATE public.rhythm_entries SET variant = 'Vibe Code' WHERE id = $1`, [id])).rejects.toThrow(/check constraint/)
    await expect(asUser(USER, `UPDATE public.rhythm_entries SET tallies = '{}' WHERE id = $1`, [id])).rejects.toThrow(/check constraint/)
  })

  it('adds marks to a session, removes them with it, and keeps them private', async () => {
    const [{ id }] = await tap(USER, 'smoking', 'urge')
    await asUser(USER, `INSERT INTO public.rhythm_marks (user_id, entry_id, level, note) VALUES ($1, $2, 4, 'strong')`, [USER, id])
    await expect(asUser(USER, `INSERT INTO public.rhythm_marks (user_id, entry_id, level) VALUES ($1, $2, 6)`, [USER, id])).rejects.toThrow(/check constraint/)
    expect(await asUser(OTHER, `SELECT id FROM public.rhythm_marks WHERE entry_id = $1`, [id])).toHaveLength(0)
    // Someone else can't hang a mark on this entry.
    await expect(asUser(OTHER, `INSERT INTO public.rhythm_marks (user_id, entry_id) VALUES ($1, $2)`, [OTHER, id])).rejects.toThrow(/row-level security/)
    await asUser(USER, `DELETE FROM public.rhythm_entries WHERE id = $1`, [id])
    expect(await asUser(USER, `SELECT id FROM public.rhythm_marks WHERE entry_id = $1`, [id])).toHaveLength(0)
  })
})
