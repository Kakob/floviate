import { describe, expect, it } from 'vitest'
import {
  NO_FEELINGS,
  RHYTHM_ACTIVITIES,
  busiestDay,
  hasFeelings,
  dailyCounts,
  dateRange,
  entriesOn,
  feelingSummary,
  occurredAt,
  trendTone,
  fromLocalInput,
  toLocalInput,
  validateEdit,
  weekOverWeek,
  cleanTallies,
  durationMs,
  entryLabel,
  entryScene,
  entryState,
  findLive,
  formatDuration,
  isStale,
  lastTallies,
  preparePatch,
  liveEntries,
  timelineFor,
  validateEnd,
  validateMark,
  type RhythmEntry,
  type RhythmVariant,
} from '@/lib/rhythm'
import { SCENE_PRESET_KEYS } from '@/lib/day-scenes'

let n = 0
function entry(partial: Partial<RhythmEntry> & { day: string; hour?: number }): RhythmEntry {
  const { day, hour = 12, ...rest } = partial
  const at = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString()
  return {
    id: `e${n++}`, user_id: 'u', activity: 'reading', kind: 'did', ...NO_FEELINGS,
    occurred_at: at, ended_at: at, variant: null, done_note: '', tallies: [], created_at: at, ...rest,
  }
}

describe('rhythm activities', () => {
  it('each has a drawn scene, and so does every variant that picks its own', () => {
    for (const a of RHYTHM_ACTIVITIES) {
      expect(SCENE_PRESET_KEYS).toContain(a.scene)
      for (const v of a.variants as readonly RhythmVariant[]) if (v.scene) expect(SCENE_PRESET_KEYS).toContain(v.scene)
    }
  })

  it('uses keys the database accepts', () => {
    const key = /^[a-z][a-z_]{0,39}$/
    for (const a of RHYTHM_ACTIVITIES) {
      expect(a.key).toMatch(key)
      for (const v of a.variants) expect(v.key).toMatch(key)
    }
  })

  it('wants smoking to go down and the rest to go up', () => {
    expect(RHYTHM_ACTIVITIES.filter(a => a.goal === 'less').map(a => a.key)).toEqual(['smoking'])
  })
})

describe('dateRange', () => {
  it('ends at the given day, oldest first, across a month boundary', () => {
    expect(dateRange('2026-10-02', 3)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02'])
  })
})

describe('dailyCounts', () => {
  it('counts taps per local day, splits urges, and zero-fills', () => {
    const entries = [
      entry({ day: '2026-10-03', activity: 'smoking', hour: 1 }),
      entry({ day: '2026-10-03', activity: 'smoking', hour: 23 }),
      entry({ day: '2026-10-03', activity: 'smoking', kind: 'urge' }),
      entry({ day: '2026-10-01', activity: 'smoking' }),
      entry({ day: '2026-10-03', activity: 'reading' }),
      entry({ day: '2026-09-01', activity: 'smoking' }),
    ]
    const days = dailyCounts(entries, 'smoking', '2026-10-03', 3)
    expect(days).toEqual([
      { date: '2026-10-01', did: 1, urge: 0, minutes: 0 },
      { date: '2026-10-02', did: 0, urge: 0, minutes: 0 },
      { date: '2026-10-03', did: 2, urge: 1, minutes: 0 },
    ])
  })

  it('adds up minutes of finished sessions on the day they started', () => {
    const start = new Date('2026-10-03T23:30:00')
    const entries = [
      entry({ day: '2026-10-03', hour: 9, ended_at: new Date('2026-10-03T09:45:00').toISOString() }),
      entry({ day: '2026-10-03', occurred_at: start.toISOString(), ended_at: new Date('2026-10-04T00:30:00').toISOString() }),
      entry({ day: '2026-10-03', hour: 14, ended_at: null }),
    ]
    expect(dailyCounts(entries, 'reading', '2026-10-03', 1)).toEqual([{ date: '2026-10-03', did: 3, urge: 0, minutes: 105 }])
  })
})

describe('weekOverWeek', () => {
  it('compares the 7 days ending today against the 7 before', () => {
    const entries = [
      entry({ day: '2026-10-03', activity: 'smoking' }),
      entry({ day: '2026-09-27', activity: 'smoking' }),
      entry({ day: '2026-09-26', activity: 'smoking' }),
      entry({ day: '2026-09-20', activity: 'smoking' }),
      entry({ day: '2026-09-19', activity: 'smoking' }),
      entry({ day: '2026-09-26', activity: 'smoking', kind: 'urge' }),
    ]
    expect(weekOverWeek(entries, 'smoking', '2026-10-03')).toEqual({ current: 2, previous: 2, change: 0 })
    expect(weekOverWeek(entries, 'smoking', '2026-09-26')).toEqual({ current: 2, previous: 1, change: 1 })
    expect(weekOverWeek(entries, 'smoking', '2026-10-03', 'urge').current).toBe(0)
  })
})

describe('trendTone', () => {
  it('reads direction against the goal', () => {
    expect(trendTone(-3, 'less')).toBe('better')
    expect(trendTone(2, 'less')).toBe('worse')
    expect(trendTone(2, 'more')).toBe('better')
    expect(trendTone(0, 'more')).toBe('same')
  })
})

describe('feelingSummary', () => {
  it('averages each moment separately, and the before-to-after shift where both were rated', () => {
    const entries = [
      entry({ day: '2026-10-03', feeling_before: 2, feeling_after: 4 }),
      entry({ day: '2026-10-02', feeling_before: 3, feeling_during: 5, feeling_after: 4 }),
      entry({ day: '2026-10-02', feeling_after: 1 }),
      entry({ day: '2026-10-02' }),
      entry({ day: '2026-08-01', feeling_before: 1, feeling_after: 5 }),
    ]
    const s = feelingSummary(entries, 'reading', '2026-10-03')
    expect(s.before).toEqual({ average: 2.5, count: 2 })
    expect(s.during).toEqual({ average: 5, count: 1 })
    expect(s.after).toEqual({ average: 3, count: 3 })
    expect(s.shift).toEqual({ average: 1.5, count: 2 })
  })

  it('has no shift when no entry was rated both before and after', () => {
    const s = feelingSummary([entry({ day: '2026-10-03', feeling_before: 2 })], 'reading', '2026-10-03')
    expect(s.shift).toEqual({ average: null, count: 0 })
  })
})

describe('hasFeelings', () => {
  it('is true once any moment has a rating or a note', () => {
    expect(hasFeelings(NO_FEELINGS)).toBe(false)
    expect(hasFeelings({ ...NO_FEELINGS, note_during: 'calm' })).toBe(true)
    expect(hasFeelings({ ...NO_FEELINGS, feeling_after: 3 })).toBe(true)
  })
})

describe('occurredAt', () => {
  it('is now on today, and the same clock time on a backfilled day', () => {
    const now = new Date('2026-10-03T15:30:00').getTime()
    expect(occurredAt('2026-10-03', now)).toBe(new Date(now).toISOString())
    expect(occurredAt('2026-10-01', now)).toBe(new Date('2026-10-01T15:30:00').toISOString())
  })
})

describe('entriesOn', () => {
  it('keeps one local day, newest first', () => {
    const late = entry({ day: '2026-10-03', hour: 22 })
    const early = entry({ day: '2026-10-03', hour: 8 })
    expect(entriesOn([early, entry({ day: '2026-10-02' }), late], '2026-10-03')).toEqual([late, early])
  })
})

describe('validateEdit', () => {
  const now = new Date('2026-10-03T15:30:00').getTime()

  it('accepts a bare entry and rejects out-of-range values', () => {
    expect(() => validateEdit(NO_FEELINGS, now)).not.toThrow()
    expect(() => validateEdit({ ...NO_FEELINGS, feeling_before: 2, feeling_during: 3, feeling_after: 5 }, now)).not.toThrow()
    expect(() => validateEdit({ ...NO_FEELINGS, feeling_during: 6 }, now)).toThrow(/during/)
    expect(() => validateEdit({ ...NO_FEELINGS, note_after: 'x'.repeat(2001) }, now)).toThrow(/after/)
  })

  it('accepts a past time and rejects a future or unreadable one', () => {
    const edit = (occurred_at: string) => () => validateEdit({ ...NO_FEELINGS, occurred_at }, now)
    expect(edit(new Date('2026-10-02T21:15:00').toISOString())).not.toThrow()
    expect(edit(new Date('2026-10-03T18:00:00').toISOString())).toThrow(/hasn’t happened/)
    expect(edit('nonsense')).toThrow()
  })
})

describe('local time inputs', () => {
  it('round-trips at minute precision in local time', () => {
    const iso = new Date('2026-10-02T21:15:42').toISOString()
    expect(toLocalInput(iso)).toBe('2026-10-02T21:15')
    expect(fromLocalInput('2026-10-02T21:15')).toBe(new Date('2026-10-02T21:15:00').toISOString())
  })

  it('rejects empty or partial values', () => {
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('2026-10-02')).toBeNull()
  })
})

describe('busiestDay', () => {
  it('picks the highest count, most recent on ties, and is null when empty', () => {
    const days = [
      { date: '2026-10-01', did: 3, urge: 9, minutes: 0 },
      { date: '2026-10-02', did: 1, urge: 0, minutes: 0 },
      { date: '2026-10-03', did: 3, urge: 0, minutes: 0 },
    ]
    expect(busiestDay(days)).toEqual({ count: 3, date: '2026-10-03' })
    expect(busiestDay(days, 'urge')).toEqual({ count: 9, date: '2026-10-01' })
    expect(busiestDay([{ date: '2026-10-01', did: 0, urge: 0, minutes: 0 }])).toBeNull()
  })
})

describe('sessions', () => {
  const iso = (s: string) => new Date(s).toISOString()

  it('tells moments, live sessions, and finished sessions apart, and how long each ran', () => {
    const moment = entry({ day: '2026-10-03', hour: 9 })
    const live = entry({ day: '2026-10-03', hour: 9, ended_at: null })
    const done = entry({ day: '2026-10-03', hour: 9, ended_at: iso('2026-10-03T10:30:00') })
    expect([moment, live, done].map(entryState)).toEqual(['moment', 'live', 'session'])
    const now = Date.parse(iso('2026-10-03T09:20:00'))
    expect([moment, live, done].map(e => durationMs(e, now) / 60_000)).toEqual([0, 20, 90])
  })

  it('formats durations', () => {
    expect(formatDuration(30_000)).toBe('<1m')
    expect(formatDuration(12 * 60_000)).toBe('12m')
    expect(formatDuration(65 * 60_000)).toBe('1h 05m')
  })

  it('lists live sessions newest first and routes a tap to the matching one', () => {
    const journal = entry({ day: '2026-10-03', hour: 9, activity: 'writing', variant: 'journal', ended_at: null })
    const vibe = entry({ day: '2026-10-03', hour: 10, activity: 'coding', variant: 'vibecode', ended_at: null })
    const writing = entry({ day: '2026-10-03', hour: 11, activity: 'writing' })
    const entries = [journal, writing, vibe]
    expect(liveEntries(entries).map(e => e.id)).toEqual([vibe.id, journal.id])
    expect(findLive(entries, 'writing', 'did', 'journal')).toBe(journal)
    // Plain writing isn't the journal session, and a finished moment never matches.
    expect(findLive(entries, 'writing', 'did', null)).toBeNull()
    expect(findLive(entries, 'smoking', 'urge', null)).toBeNull()
  })

  it('flags sessions left running for 12 hours', () => {
    const live = entry({ day: '2026-10-03', hour: 8, ended_at: null })
    expect(isStale(live, Date.parse(iso('2026-10-03T19:00:00')))).toBe(false)
    expect(isStale(live, Date.parse(iso('2026-10-03T20:00:00')))).toBe(true)
  })

  it('labels and draws variants and urges', () => {
    expect(entryLabel(entry({ day: '2026-10-03', activity: 'coding', variant: 'vibecode' }))).toBe('Vibecode')
    expect(entryLabel(entry({ day: '2026-10-03', activity: 'coding' }))).toBe('Coding')
    expect(entryLabel(entry({ day: '2026-10-03', activity: 'smoking', kind: 'urge' }))).toBe('Urge to smoke, let it pass')
    expect(entryLabel(entry({ day: '2026-10-03', activity: 'smoking', kind: 'urge', ended_at: null }))).toBe('Craving')
    expect(entryScene({ activity: 'exercise', variant: 'run' })).toBe('running')
    expect(entryScene({ activity: 'exercise', variant: 'gym' })).toBe('gym')
    expect(entryScene({ activity: 'exercise', variant: 'gone' })).toBe('gym')
  })

  it('starts from the last tallies of the same thing', () => {
    const rows = [{ label: 'Bench', value: '3x8', unit: '135 lb' }]
    const entries = [
      entry({ day: '2026-10-01', activity: 'exercise', variant: 'gym', tallies: rows }),
      entry({ day: '2026-10-02', activity: 'exercise', variant: 'gym', tallies: [] }),
      entry({ day: '2026-10-02', activity: 'exercise', variant: 'run', tallies: [{ label: 'Miles', value: '3', unit: '' }] }),
    ]
    const last = lastTallies(entries, 'exercise', 'gym')
    expect(last).toEqual(rows)
    expect(last[0]).not.toBe(rows[0])
    expect(lastTallies(entries, 'exercise', 'home')).toEqual([])
  })

  it('trims tallies and drops empty rows', () => {
    expect(cleanTallies([{ label: ' Bench ', value: '3x8', unit: '' }, { label: ' ', value: '', unit: '' }])).toEqual([
      { label: 'Bench', value: '3x8', unit: '' },
    ])
  })

  it('checks a session end', () => {
    const start = iso('2026-10-03T09:00:00')
    const now = Date.parse(iso('2026-10-03T12:00:00'))
    const ok = { ended_at: iso('2026-10-03T10:00:00'), done_note: '', tallies: [] }
    expect(() => validateEnd(ok, start, now)).not.toThrow()
    expect(() => validateEnd({ ...ok, ended_at: iso('2026-10-03T08:00:00') }, start, now)).toThrow(/before it started/)
    expect(() => validateEnd({ ...ok, ended_at: iso('2026-10-03T13:00:00') }, start, now)).toThrow(/hasn’t happened/)
    expect(() => validateEnd({ ...ok, ended_at: iso('2026-10-04T10:00:00') }, start, Date.parse(iso('2026-10-05T00:00:00')))).toThrow(/24 hours/)
  })

  it('checks a mark', () => {
    expect(() => validateMark({ level: 3, note: '' })).not.toThrow()
    expect(() => validateMark({ level: null, note: 'hm' })).not.toThrow()
    expect(() => validateMark({ level: null, note: '  ' })).toThrow(/level or a note/)
    expect(() => validateMark({ level: 6, note: '' })).toThrow(/1 to 5/)
  })

  it('lays the day out: spans for sessions, points for moments, clipped to the day, live ones to now', () => {
    const overnight = entry({ day: '2026-10-02', occurred_at: iso('2026-10-02T23:00:00'), ended_at: iso('2026-10-03T01:00:00') })
    const moment = entry({ day: '2026-10-03', hour: 9 })
    const live = entry({ day: '2026-10-03', hour: 10, ended_at: null })
    const yesterday = entry({ day: '2026-10-02', hour: 9 })
    const now = Date.parse(iso('2026-10-03T10:30:00'))
    const items = timelineFor([live, moment, overnight, yesterday], '2026-10-03', now)
    expect(items.map(i => [i.entry.id, i.shape, i.startMin, i.endMin])).toEqual([
      [overnight.id, 'span', 0, 60],
      [moment.id, 'point', 540, 540],
      [live.id, 'span', 600, 630],
    ])
  })

  it('prepares edits: a moved moment stays a moment, a session keeps its end, and bad ends are refused', () => {
    const now = Date.parse(iso('2026-10-03T12:00:00'))
    const moment = { occurred_at: iso('2026-10-03T09:00:00'), ended_at: iso('2026-10-03T09:00:00') }
    expect(preparePatch(moment, { occurred_at: iso('2026-10-03T08:00:00') }, now)).toEqual({
      occurred_at: iso('2026-10-03T08:00:00'),
      ended_at: iso('2026-10-03T08:00:00'),
    })
    const session = { occurred_at: iso('2026-10-03T09:00:00'), ended_at: iso('2026-10-03T10:00:00') }
    expect(preparePatch(session, { occurred_at: iso('2026-10-03T08:00:00') }, now)).toEqual({ occurred_at: iso('2026-10-03T08:00:00') })
    expect(() => preparePatch(session, { occurred_at: iso('2026-10-03T11:00:00') }, now)).toThrow(/before it started/)
    expect(preparePatch(moment, { ended_at: null }, now)).toEqual({ ended_at: null })
    expect(() => preparePatch(moment, { feeling_after: 9 }, now)).toThrow(/1 to 5/)
  })
})
