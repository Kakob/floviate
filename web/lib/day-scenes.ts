// Living Day Scenes domain logic. Pure: no React, Supabase, clock, or audio dependencies.

export const SCENE_PRESET_KEYS = [
  'writing', 'computer', 'trading', 'library', 'reading', 'music', 'art',
  'walking', 'running', 'biking', 'gym', 'home_workout',
  'eating', 'smoking', 'bathroom', 'quiet',
  'driving', 'doctor',
] as const
export type ScenePreset = (typeof SCENE_PRESET_KEYS)[number]

export type DayBlockStatus = 'planned' | 'skipped' | 'done'

/** A planned part of the day. Intention only: never evidence that anything happened. */
export interface DayBlock {
  id: string
  user_id: string
  item_id: string | null
  plan_date: string
  position: number
  title: string
  intention: string
  planned_start: string | null
  planned_end: string | null
  scene: ScenePreset
  status: DayBlockStatus
  created_at: string
  updated_at: string
}

export type DayBlockInput = Pick<
  DayBlock,
  'plan_date' | 'title' | 'intention' | 'planned_start' | 'planned_end' | 'scene' | 'item_id'
>

/** Kinds a user records. Plan history kinds are written only by the server. */
export type CheckInKind = 'thought' | 'started' | 'changed_activity'
export type DayEventKind = CheckInKind | 'plan_changed' | 'finished' | 'skipped'

/** An observed/logged event, stored as a log_entries row. */
export interface DayCheckIn {
  id: string
  day_block_id: string | null
  session_id: string | null
  event_kind: DayEventKind
  value_text: string | null
  created_at: string
  plan_snapshot: DayBlock | null
  previous_plan: DayBlock | null
}

/** Which scene the page is showing. 'current' follows the clock and the plan order. */
export type SceneSelection =
  | { kind: 'current' }
  | { kind: 'block'; id: string }
  | { kind: 'unplanned' }

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** UTC bounds of a local calendar day. Local midnight arithmetic keeps DST days correct. */
export function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function isTimed(block: DayBlock): block is DayBlock & { planned_start: string; planned_end: string } {
  return block.planned_start !== null && block.planned_end !== null
}

/** Plan order: position first, then start time for ties, then id for stability. */
export function orderBlocks(blocks: DayBlock[]): DayBlock[] {
  return [...blocks].sort((a, b) =>
    a.position - b.position ||
    (a.planned_start ? Date.parse(a.planned_start) : Infinity) - (b.planned_start ? Date.parse(b.planned_start) : Infinity) ||
    a.id.localeCompare(b.id)
  )
}

/**
 * What the user intended to be doing now:
 * 1. a planned timed block covering now (latest start wins on overlap), else
 * 2. the first planned untimed block in plan order, else
 * 3. nothing (unplanned time).
 * Timed blocks whose time has passed are simply not current; they are never marked done.
 */
export function currentBlock(blocks: DayBlock[], now: number): DayBlock | null {
  const planned = blocks.filter(b => b.status === 'planned')
  const covering = planned
    .filter(isTimed)
    .filter(b => Date.parse(b.planned_start) <= now && now < Date.parse(b.planned_end))
    .sort((a, b) => Date.parse(b.planned_start) - Date.parse(a.planned_start) || a.id.localeCompare(b.id))
  if (covering.length) return covering[0]
  return orderBlocks(planned).find(b => !isTimed(b)) ?? null
}

export function resolveSelection(blocks: DayBlock[], selection: SceneSelection, now: number): DayBlock | null {
  if (selection.kind === 'unplanned') return null
  if (selection.kind === 'block') return blocks.find(b => b.id === selection.id) ?? null
  return currentBlock(blocks, now)
}

/** The position that puts a new block at the end of the day's order. */
export function nextPosition(blocks: DayBlock[]): number {
  return blocks.reduce((max, b) => Math.max(max, b.position), 0) + 1
}

export function validateBlock(input: DayBlockInput) {
  if (!input.title.trim() || input.title.length > 200) {
    throw new Error('Give this part of the day a name (up to 200 characters).')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.plan_date)) throw new Error('Choose a day for this plan.')
  if ((input.planned_start === null) !== (input.planned_end === null)) {
    throw new Error('Set both a start and an end, or leave the time open.')
  }
  if (input.planned_start !== null && input.planned_end !== null) {
    const start = Date.parse(input.planned_start)
    const end = Date.parse(input.planned_end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86400000) {
      throw new Error('Choose an end after the start, within 24 hours.')
    }
  }
  if (input.intention.length > 4000) throw new Error('Keep the intention under 4,000 characters.')
  if (!(SCENE_PRESET_KEYS as readonly string[]).includes(input.scene)) throw new Error('Choose a scene.')
}
