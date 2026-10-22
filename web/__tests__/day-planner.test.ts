import { describe, it, expect } from 'vitest'
import { addDays, atMinutes, blockSpan, copyDayTo, placeBlock, weekDates } from '@/lib/day-planner'
import { layoutLanes } from '@/lib/time-grid'
import type { DayBlock } from '@/lib/day-scenes'

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`).toISOString()

function block(overrides: Partial<DayBlock> & { id: string }): DayBlock {
  return {
    user_id: 'user-1',
    item_id: null,
    plan_date: '2026-09-24',
    position: 1,
    title: overrides.id,
    intention: '',
    planned_start: null,
    planned_end: null,
    scene: 'gym',
    status: 'planned',
    created_at: at('2026-09-24', '06:00'),
    updated_at: at('2026-09-24', '06:00'),
    ...overrides,
  }
}

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('returns the Monday–Sunday week containing a date', () => {
    expect(weekDates('2026-09-24')).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
    ])
    expect(weekDates('2026-09-27')[0]).toBe('2026-09-21')
    expect(weekDates('2026-09-21')[6]).toBe('2026-09-27')
  })

  it('keeps wall-clock times on a DST change day', () => {
    const iso = atMinutes('2026-03-08', 9 * 60)
    expect(new Date(iso).getHours()).toBe(9)
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
  })
})

describe('blockSpan and placeBlock', () => {
  it('places a timed block by minutes into its day', () => {
    const b = block({ id: 'gym', planned_start: at('2026-09-24', '07:15'), planned_end: at('2026-09-24', '08:45') })
    expect(blockSpan(b)).toEqual({ startMin: 435, endMin: 525 })
  })

  it('returns null for an any-time block', () => {
    expect(blockSpan(block({ id: 'walk' }))).toBeNull()
  })

  it('clamps a block that runs past midnight to its own day', () => {
    const b = block({ id: 'late', planned_start: at('2026-09-24', '23:00'), planned_end: at('2026-09-25', '01:00') })
    expect(blockSpan(b)).toEqual({ startMin: 1380, endMin: 1440 })
  })

  it('moves a block to another day and time, keeping what it is', () => {
    const b = block({ id: 'gym', intention: 'Legs', scene: 'gym' })
    const placed = placeBlock(b, '2026-09-26', 600, 660)
    expect(placed.plan_date).toBe('2026-09-26')
    expect(new Date(placed.planned_start!).getHours()).toBe(10)
    expect(new Date(placed.planned_end!).getHours()).toBe(11)
    expect(placed).toMatchObject({ title: 'gym', intention: 'Legs', scene: 'gym' })
  })
})

describe('copyDayTo', () => {
  const day = [
    block({ id: 'gym', position: 1, planned_start: at('2026-09-24', '07:00'), planned_end: at('2026-09-24', '08:00') }),
    block({ id: 'walk', position: 2 }),
    block({ id: 'skipped', position: 3, status: 'skipped' }),
    block({ id: 'late', position: 4, planned_start: at('2026-09-24', '23:30'), planned_end: at('2026-09-25', '00:30') }),
  ]

  it('repeats plans at the same wall-clock times on each target day', () => {
    const copies = copyDayTo(day, [{ date: '2026-09-28', nextPosition: 5 }])
    const gym = copies.find(c => c.title === 'gym')!
    expect(gym.plan_date).toBe('2026-09-28')
    expect(new Date(gym.planned_start!).getHours()).toBe(7)
    expect(Date.parse(gym.planned_end!) - Date.parse(gym.planned_start!)).toBe(3600000)
  })

  it('keeps any-time plans untimed and puts copies after existing plans', () => {
    const copies = copyDayTo(day, [{ date: '2026-09-28', nextPosition: 5 }])
    const walk = copies.find(c => c.title === 'walk')!
    expect(walk.planned_start).toBeNull()
    expect(copies.map(c => c.position)).toEqual([5, 6, 7])
  })

  it('does not copy skipped plans, or statuses', () => {
    const copies = copyDayTo(day, [{ date: '2026-09-28', nextPosition: 1 }])
    expect(copies.map(c => c.title)).toEqual(['gym', 'walk', 'late'])
    expect(copies.every(c => !('status' in c))).toBe(true)
  })

  it('keeps the full length of a plan that runs past midnight', () => {
    const late = copyDayTo(day, [{ date: '2026-09-28', nextPosition: 1 }]).find(c => c.title === 'late')!
    expect(Date.parse(late.planned_end!) - Date.parse(late.planned_start!)).toBe(3600000)
  })

  it('copies to several days at once', () => {
    const copies = copyDayTo(day, [
      { date: '2026-09-28', nextPosition: 1 },
      { date: '2026-09-29', nextPosition: 4 },
    ])
    expect(copies).toHaveLength(6)
    expect(new Set(copies.map(c => c.plan_date))).toEqual(new Set(['2026-09-28', '2026-09-29']))
  })
})

describe('layoutLanes', () => {
  it('puts overlapping plans side by side and leaves others full width', () => {
    const laid = layoutLanes([
      { id: 'a', startMin: 60, endMin: 120 },
      { id: 'b', startMin: 90, endMin: 150 },
      { id: 'c', startMin: 200, endMin: 260 },
    ])
    const byId = Object.fromEntries(laid.map(l => [l.id, l]))
    expect(byId.a).toMatchObject({ lane: 0, totalLanes: 2 })
    expect(byId.b).toMatchObject({ lane: 1, totalLanes: 2 })
    expect(byId.c).toMatchObject({ lane: 0, totalLanes: 1 })
  })
})
