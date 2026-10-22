// Daily rhythm domain logic. Pure: no React, Supabase, or clock dependencies.
import { addDays } from '@/lib/day-planner'
import { dayBounds, localDate, type ScenePreset } from '@/lib/day-scenes'
import { MINUTES_PER_DAY } from '@/lib/time-grid'

export type RhythmKind = 'did' | 'urge'
export type RhythmMoment = 'before' | 'during' | 'after'

export interface RhythmEntry {
  id: string
  user_id: string
  activity: RhythmActivityKey
  kind: RhythmKind
  /** 1 (rough) to 5 (great) for each moment, or null when not rated. */
  feeling_before: number | null
  feeling_during: number | null
  feeling_after: number | null
  note_before: string
  note_during: string
  note_after: string
  occurred_at: string
  /** Equal to occurred_at for a moment, null while a session is live, later once it has ended. */
  ended_at: string | null
  /** A sub-option of the activity (writing → journal), or null for the activity itself. */
  variant: string | null
  /** What got done, filled in when a session ends. */
  done_note: string
  tallies: RhythmTally[]
  /** Marks added while it ran, oldest first. Present when loaded with the entry. */
  marks?: RhythmMark[]
  created_at: string
}

/** One row of "what got done": e.g. Bench · 3x8 · 135 lb, or Pages · 4. All free text. */
export interface RhythmTally {
  label: string
  value: string
  unit: string
}

/** A timestamped note during a session, with an optional 1-5 level (a feeling, or an urge's strength). */
export interface RhythmMark {
  id: string
  user_id: string
  entry_id: string
  at: string
  level: number | null
  note: string
  created_at: string
}

export interface RhythmVariant {
  key: string
  label: string
  /** Defaults to the activity's scene. */
  scene?: ScenePreset
}

export interface RhythmActivity {
  key: string
  label: string
  scene: ScenePreset
  /** Which way the user wants this to go. */
  goal: 'more' | 'less'
  /** Whether noticing an urge without acting on it is tracked. */
  urges: boolean
  /** Sub-options offered under the main tap, like the urge button. */
  variants: readonly RhythmVariant[]
}

export const RHYTHM_ACTIVITIES = [
  { key: 'reading', label: 'Reading', scene: 'reading', goal: 'more', urges: false, variants: [] },
  { key: 'writing', label: 'Writing', scene: 'writing', goal: 'more', urges: false, variants: [{ key: 'journal', label: 'Journal' }] },
  { key: 'coding', label: 'Coding', scene: 'computer', goal: 'more', urges: false, variants: [{ key: 'vibecode', label: 'Vibecode' }] },
  { key: 'art', label: 'Art', scene: 'art', goal: 'more', urges: false, variants: [] },
  { key: 'music', label: 'Music', scene: 'music', goal: 'more', urges: false, variants: [{ key: 'listening', label: 'Listening', scene: 'reading' }] },
  { key: 'trading', label: 'Trading', scene: 'trading', goal: 'more', urges: false, variants: [] },
  {
    key: 'exercise',
    label: 'Exercise',
    scene: 'gym',
    goal: 'more',
    urges: false,
    variants: [
      { key: 'gym', label: 'Gym' },
      { key: 'home', label: 'At home', scene: 'home_workout' },
      { key: 'run', label: 'Run', scene: 'running' },
      { key: 'walk', label: 'Walk', scene: 'walking' },
      { key: 'bike', label: 'Bike', scene: 'biking' },
    ],
  },
  { key: 'smoking', label: 'Smoking', scene: 'smoking', goal: 'less', urges: true, variants: [] },
] as const satisfies readonly RhythmActivity[]

export type RhythmActivityKey = (typeof RHYTHM_ACTIVITIES)[number]['key']

export const FEELINGS = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
] as const

export const MOMENTS: { value: RhythmMoment; label: string }[] = [
  { value: 'before', label: 'Before' },
  { value: 'during', label: 'During' },
  { value: 'after', label: 'After' },
]

/** How many days of history the board loads: the trend window plus an equal window to compare against. */
export const TREND_DAYS = 28

export const feelingKey = (moment: RhythmMoment) => `feeling_${moment}` as const
export const noteKey = (moment: RhythmMoment) => `note_${moment}` as const

/** The per-moment feelings and notes on an entry. */
export type RhythmFeelings = Pick<RhythmEntry, `feeling_${RhythmMoment}` | `note_${RhythmMoment}`>

export const NO_FEELINGS: RhythmFeelings = {
  feeling_before: null, feeling_during: null, feeling_after: null,
  note_before: '', note_during: '', note_after: '',
}

/** Whether anything beyond the tap itself was recorded. */
export const hasFeelings = (entry: RhythmFeelings) =>
  MOMENTS.some(({ value }) => entry[feelingKey(value)] !== null || entry[noteKey(value)] !== '')

/** What can be changed on an entry after the tap. */
export type RhythmEdit = RhythmFeelings & {
  /** ISO time it happened; omitted to leave it unchanged. */
  occurred_at?: string
}

/** Small allowance for clock skew between this device and the server. */
const FUTURE_SLACK_MS = 60_000

function checkFeelings(input: Partial<RhythmFeelings>) {
  for (const { value, label } of MOMENTS) {
    const feeling = input[feelingKey(value)]
    if (feeling != null && !(Number.isInteger(feeling) && feeling >= 1 && feeling <= 5)) {
      throw new Error(`Choose a feeling from 1 to 5 for ${label.toLowerCase()}.`)
    }
    if ((input[noteKey(value)]?.length ?? 0) > 2000) throw new Error(`Keep the ${label.toLowerCase()} note under 2,000 characters.`)
  }
}

function checkNotFuture(iso: string, now: number) {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) throw new Error('Choose when it happened.')
  if (at > now + FUTURE_SLACK_MS) throw new Error('That time hasn’t happened yet.')
}

export function validateEdit(input: RhythmEdit, now: number) {
  checkFeelings(input)
  if (input.occurred_at !== undefined) checkNotFuture(input.occurred_at, now)
}

/** An ISO time as a local `datetime-local` input value (minute precision). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** A `datetime-local` value, read as local time, back to ISO; null if it isn't a valid time. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const at = new Date(value)
  return Number.isFinite(at.getTime()) ? at.toISOString() : null
}

/**
 * When a tap on `date` happened. Today it is now; on another day it is that day at the
 * current clock time, so forgotten taps can be backfilled onto the right day.
 */
export function occurredAt(date: string, now: number): string {
  const clock = new Date(now)
  if (localDate(clock) === date) return clock.toISOString()
  const at = new Date(`${date}T00:00:00`)
  at.setHours(clock.getHours(), clock.getMinutes(), clock.getSeconds())
  return at.toISOString()
}

/** The local dates of the `days` days ending at (and including) `endDate`, oldest first. */
export function dateRange(endDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(endDate, i - days + 1))
}

const entryDate = (entry: RhythmEntry) => localDate(new Date(entry.occurred_at))

export interface DayCount {
  date: string
  did: number
  urge: number
  /** Minutes spent in finished `did` sessions that started that day. Live sessions count once they end. */
  minutes: number
}

/** Per-day counts for one activity across the window ending at `endDate`. Days with nothing are zero. */
export function dailyCounts(entries: RhythmEntry[], activity: string, endDate: string, days = TREND_DAYS): DayCount[] {
  const counts = new Map(dateRange(endDate, days).map(date => [date, { date, did: 0, urge: 0, minutes: 0 }]))
  for (const entry of entries) {
    if (entry.activity !== activity) continue
    const day = counts.get(entryDate(entry))
    if (!day) continue
    day[entry.kind] += 1
    if (entry.kind === 'did' && entryState(entry) === 'session') day.minutes += Math.round(durationMs(entry, 0) / 60_000)
  }
  return Array.from(counts.values())
}

export interface RhythmPeak {
  activity: string
  kind: RhythmKind
  peak: number
  /** Local date (YYYY-MM-DD) of the busiest day. */
  peak_date: string
}

/** The busiest day in a run of daily counts, most recent on ties; null when nothing was logged. */
export function busiestDay(days: DayCount[], kind: RhythmKind = 'did'): { count: number; date: string } | null {
  let best: { count: number; date: string } | null = null
  for (const day of days) {
    if (day[kind] > 0 && (!best || day[kind] >= best.count)) best = { count: day[kind], date: day.date }
  }
  return best
}

/** This week (the 7 days ending at `endDate`) against the 7 days before it. */
export function weekOverWeek(entries: RhythmEntry[], activity: string, endDate: string, kind: RhythmKind = 'did') {
  const recent = new Set(dateRange(endDate, 7))
  const prior = new Set(dateRange(addDays(endDate, -7), 7))
  let current = 0
  let previous = 0
  for (const entry of entries) {
    if (entry.activity !== activity || entry.kind !== kind) continue
    const day = entryDate(entry)
    if (recent.has(day)) current += 1
    else if (prior.has(day)) previous += 1
  }
  return { current, previous, change: current - previous }
}

/**
 * Whether a change is the direction the user wants. Flat is neutral.
 * For smoking, resisted urges going up is also good news, so callers pass the goal explicitly.
 */
export function trendTone(change: number, goal: 'more' | 'less'): 'better' | 'worse' | 'same' {
  if (change === 0) return 'same'
  return (change > 0) === (goal === 'more') ? 'better' : 'worse'
}

export interface FeelingSummary {
  average: number | null
  count: number
}

const average = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null

/**
 * Average feeling for an activity within the window, per moment. Unrated moments are ignored.
 * `shift` is the average change from before to after, over entries rated at both.
 */
export function feelingSummary(entries: RhythmEntry[], activity: string, endDate: string, days = TREND_DAYS) {
  const window = new Set(dateRange(endDate, days))
  const buckets: Record<RhythmMoment, number[]> = { before: [], during: [], after: [] }
  const shifts: number[] = []
  for (const entry of entries) {
    if (entry.activity !== activity || !window.has(entryDate(entry))) continue
    for (const { value } of MOMENTS) {
      const feeling = entry[feelingKey(value)]
      if (feeling !== null) buckets[value].push(feeling)
    }
    if (entry.feeling_before !== null && entry.feeling_after !== null) shifts.push(entry.feeling_after - entry.feeling_before)
  }
  const summarize = (values: number[]): FeelingSummary => ({ average: average(values), count: values.length })
  return {
    before: summarize(buckets.before),
    during: summarize(buckets.during),
    after: summarize(buckets.after),
    shift: summarize(shifts),
  }
}

/** Entries on one local date, newest first. */
export function entriesOn(entries: RhythmEntry[], date: string): RhythmEntry[] {
  return entries
    .filter(entry => entryDate(entry) === date)
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
}

export const activityByKey = (key: string): RhythmActivity | undefined => RHYTHM_ACTIVITIES.find(a => a.key === key)

// Sessions ---------------------------------------------------------------------------------

export type EntryState = 'moment' | 'live' | 'session'

export function entryState(entry: Pick<RhythmEntry, 'occurred_at' | 'ended_at'>): EntryState {
  if (entry.ended_at === null) return 'live'
  return Date.parse(entry.ended_at) > Date.parse(entry.occurred_at) ? 'session' : 'moment'
}

/** How long it ran: up to `now` while live, zero for a moment. */
export function durationMs(entry: Pick<RhythmEntry, 'occurred_at' | 'ended_at'>, now: number): number {
  const end = entry.ended_at === null ? now : Date.parse(entry.ended_at)
  return Math.max(0, end - Date.parse(entry.occurred_at))
}

/** "1h 05m", "12m", or "<1m". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m'
  const h = Math.floor(minutes / 60)
  return h ? `${h}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

/** Sessions still running, most recently started first. */
export function liveEntries(entries: RhythmEntry[]): RhythmEntry[] {
  return entries
    .filter(entry => entry.ended_at === null)
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
}

/** The live session a tap belongs to, if any: a tap on something already running adds a mark to it. */
export function findLive(entries: RhythmEntry[], activity: string, kind: RhythmKind, variant: string | null) {
  return liveEntries(entries).find(e => e.activity === activity && e.kind === kind && e.variant === variant) ?? null
}

/** A live session this old was probably forgotten. */
export const STALE_LIVE_MS = 12 * 60 * 60_000

export const isStale = (entry: RhythmEntry, now: number) => entry.ended_at === null && durationMs(entry, now) >= STALE_LIVE_MS

export const variantOf = (entry: Pick<RhythmEntry, 'activity' | 'variant'>) =>
  entry.variant ? activityByKey(entry.activity)?.variants.find(v => v.key === entry.variant) : undefined

export function entryLabel(entry: Pick<RhythmEntry, 'activity' | 'variant' | 'kind' | 'occurred_at' | 'ended_at'>): string {
  // Smoking is the only activity with urges, so the wording can be specific.
  if (entry.kind === 'urge') return entryState(entry) === 'moment' ? 'Urge to smoke, let it pass' : 'Craving'
  return variantOf(entry)?.label ?? activityByKey(entry.activity)?.label ?? entry.activity
}

export function entryScene(entry: Pick<RhythmEntry, 'activity' | 'variant'>): ScenePreset {
  return variantOf(entry)?.scene ?? activityByKey(entry.activity)?.scene ?? 'quiet'
}

/** The tallies from the last session of the same thing, to start the next one from. */
export function lastTallies(entries: RhythmEntry[], activity: string, variant: string | null, exceptId?: string): RhythmTally[] {
  const last = entries
    .filter(e => e.id !== exceptId && e.activity === activity && e.variant === variant && e.tallies.length)
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))[0]
  return last ? last.tallies.map(t => ({ ...t })) : []
}

/** Trims tally rows and drops empty ones. */
export const cleanTallies = (rows: RhythmTally[]): RhythmTally[] =>
  rows
    .map(row => ({ label: row.label.trim(), value: row.value.trim(), unit: row.unit.trim() }))
    .filter(row => row.label || row.value || row.unit)

const MAX_SESSION_MS = 24 * 60 * 60_000

/** Any change to an entry after the tap: feelings, when it started, ending or reopening it, what got done. */
export type RhythmPatch = Partial<RhythmFeelings> & {
  occurred_at?: string
  /** null reopens it as a live session. */
  ended_at?: string | null
  done_note?: string
  tallies?: RhythmTally[]
}

/**
 * Checks a patch against the entry it changes and fills in what follows from it: moving a moment's
 * time moves its end too, so it stays a moment. Throws a readable error when something doesn't fit.
 */
export function preparePatch(entry: Pick<RhythmEntry, 'occurred_at' | 'ended_at'>, patch: RhythmPatch, now: number): RhythmPatch {
  const out = { ...patch }
  checkFeelings(out)
  if (out.occurred_at !== undefined) {
    checkNotFuture(out.occurred_at, now)
    if (entryState(entry) === 'moment' && out.ended_at === undefined) out.ended_at = out.occurred_at
  }
  const start = out.occurred_at ?? entry.occurred_at
  const end = out.ended_at !== undefined ? out.ended_at : entry.ended_at
  if (end !== null) validateEnd({ ended_at: end, done_note: out.done_note ?? '', tallies: out.tallies ?? [] }, start, now)
  return out
}

/** What ending a session can set. */
export interface RhythmEnd {
  ended_at: string
  done_note: string
  tallies: RhythmTally[]
}

export function validateEnd(input: RhythmEnd, occurredAtIso: string, now: number) {
  const end = Date.parse(input.ended_at)
  const start = Date.parse(occurredAtIso)
  if (!Number.isFinite(end)) throw new Error('Choose when it ended.')
  if (end < start) throw new Error('It can’t end before it started.')
  if (end - start > MAX_SESSION_MS) throw new Error('A session can run at most 24 hours. Check the start and end.')
  if (end > now + FUTURE_SLACK_MS) throw new Error('That time hasn’t happened yet.')
  if (input.done_note.length > 2000) throw new Error('Keep what got done under 2,000 characters.')
  if (input.tallies.length > 30) throw new Error('Keep it to 30 rows.')
  for (const row of input.tallies) {
    if (row.label.length > 80 || row.value.length > 80 || row.unit.length > 40) throw new Error('Keep each row short.')
  }
}

export function validateMark(input: { level: number | null; note: string }) {
  if (input.level !== null && !(Number.isInteger(input.level) && input.level >= 1 && input.level <= 5)) {
    throw new Error('Choose a level from 1 to 5.')
  }
  if (input.note.length > 2000) throw new Error('Keep the note under 2,000 characters.')
  if (input.level === null && !input.note.trim()) throw new Error('Add a level or a note.')
}

const minutesIntoDay = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60

export interface TimelineItem {
  entry: RhythmEntry
  startMin: number
  endMin: number
  /** Sessions and live ones are spans; moments are points. */
  shape: 'span' | 'point'
}

/** Entries that touch `date`, in minutes from local midnight, clipped to the day. Live sessions run to `now`. */
export function timelineFor(entries: RhythmEntry[], date: string, now: number): TimelineItem[] {
  const { start, end } = dayBounds(date)
  const dayStart = Date.parse(start)
  const dayEnd = Date.parse(end)
  const items: TimelineItem[] = []
  for (const entry of entries) {
    const from = Date.parse(entry.occurred_at)
    const to = entry.ended_at === null ? Math.max(now, from) : Date.parse(entry.ended_at)
    if (to < dayStart || from >= dayEnd) continue
    const state = entryState(entry)
    const startMin = from <= dayStart ? 0 : minutesIntoDay(new Date(from))
    const endMin = to >= dayEnd ? MINUTES_PER_DAY : minutesIntoDay(new Date(to))
    items.push({ entry, startMin, endMin: Math.max(endMin, startMin), shape: state === 'moment' ? 'point' : 'span' })
  }
  return items.sort((a, b) => a.startMin - b.startMin)
}
