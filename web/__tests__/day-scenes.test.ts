import { describe, it, expect } from 'vitest'
import {
  currentBlock,
  dayBounds,
  nextPosition,
  orderBlocks,
  resolveSelection,
  validateBlock,
  type DayBlock,
  type DayBlockInput,
} from '@/lib/day-scenes'

const at = (hhmm: string) => new Date(`2026-09-24T${hhmm}:00`).toISOString()
const nowAt = (hhmm: string) => Date.parse(at(hhmm))

function block(overrides: Partial<DayBlock> & { id: string }): DayBlock {
  return {
    user_id: 'user-1',
    item_id: null,
    plan_date: '2026-09-24',
    position: 0,
    title: overrides.id,
    intention: '',
    planned_start: null,
    planned_end: null,
    scene: 'quiet',
    status: 'planned',
    created_at: at('06:00'),
    updated_at: at('06:00'),
    ...overrides,
  }
}

const input = (overrides: Partial<DayBlockInput> = {}): DayBlockInput => ({
  plan_date: '2026-09-24',
  title: 'Writing',
  intention: '',
  planned_start: null,
  planned_end: null,
  scene: 'writing',
  item_id: null,
  ...overrides,
})

describe('currentBlock', () => {
  it('returns null when nothing is planned', () => {
    expect(currentBlock([], nowAt('10:00'))).toBeNull()
  })

  it('prefers a timed block covering now over untimed blocks earlier in the order', () => {
    const blocks = [
      block({ id: 'untimed', position: 1 }),
      block({ id: 'walk', position: 2, planned_start: at('09:30'), planned_end: at('10:30') }),
    ]
    expect(currentBlock(blocks, nowAt('10:00'))?.id).toBe('walk')
  })

  it('treats the start as inclusive and the end as exclusive', () => {
    const blocks = [block({ id: 'walk', planned_start: at('09:00'), planned_end: at('10:00') })]
    expect(currentBlock(blocks, nowAt('09:00'))?.id).toBe('walk')
    expect(currentBlock(blocks, nowAt('10:00'))).toBeNull()
  })

  it('picks the latest-starting block when timed blocks overlap', () => {
    const blocks = [
      block({ id: 'morning', planned_start: at('08:00'), planned_end: at('12:00') }),
      block({ id: 'call', planned_start: at('10:00'), planned_end: at('10:30') }),
    ]
    expect(currentBlock(blocks, nowAt('10:15'))?.id).toBe('call')
    expect(currentBlock(blocks, nowAt('11:00'))?.id).toBe('morning')
  })

  it('falls back to the first planned untimed block in order', () => {
    const blocks = [
      block({ id: 'dinner', position: 3 }),
      block({ id: 'programming', position: 1 }),
      block({ id: 'walk', position: 2 }),
    ]
    expect(currentBlock(blocks, nowAt('10:00'))?.id).toBe('programming')
  })

  it('passes over timed blocks that have ended or not yet begun without treating them as done', () => {
    const blocks = [
      block({ id: 'earlier', position: 1, planned_start: at('07:00'), planned_end: at('08:00') }),
      block({ id: 'later', position: 2, planned_start: at('18:00'), planned_end: at('19:00') }),
      block({ id: 'open', position: 3 }),
    ]
    expect(currentBlock(blocks, nowAt('10:00'))?.id).toBe('open')
    expect(blocks[0].status).toBe('planned')
  })

  it('never shows skipped or done blocks as current', () => {
    const blocks = [
      block({ id: 'skipped', position: 1, status: 'skipped' }),
      block({ id: 'done', position: 2, status: 'done' }),
      block({ id: 'timed-skip', status: 'skipped', planned_start: at('09:00'), planned_end: at('11:00') }),
      block({ id: 'next', position: 3 }),
    ]
    expect(currentBlock(blocks, nowAt('10:00'))?.id).toBe('next')
  })
})

describe('resolveSelection', () => {
  const blocks = [block({ id: 'a', position: 1 }), block({ id: 'b', position: 2 })]

  it('follows the current block by default', () => {
    expect(resolveSelection(blocks, { kind: 'current' }, nowAt('10:00'))?.id).toBe('a')
  })

  it('revisits a chosen block', () => {
    expect(resolveSelection(blocks, { kind: 'block', id: 'b' }, nowAt('10:00'))?.id).toBe('b')
  })

  it('shows unplanned time when asked', () => {
    expect(resolveSelection(blocks, { kind: 'unplanned' }, nowAt('10:00'))).toBeNull()
  })
})

describe('orderBlocks and nextPosition', () => {
  it('orders by position, then start time, then id', () => {
    const ordered = orderBlocks([
      block({ id: 'c', position: 2 }),
      block({ id: 'b', position: 1, planned_start: at('12:00'), planned_end: at('13:00') }),
      block({ id: 'a', position: 1, planned_start: at('09:00'), planned_end: at('10:00') }),
      block({ id: 'd', position: 1 }),
    ])
    expect(ordered.map(b => b.id)).toEqual(['a', 'b', 'd', 'c'])
  })

  it('appends new blocks after the last position', () => {
    expect(nextPosition([])).toBe(1)
    expect(nextPosition([block({ id: 'a', position: 4 }), block({ id: 'b', position: 2 })])).toBe(5)
  })
})

describe('validateBlock', () => {
  it('accepts an untimed plan', () => {
    expect(() => validateBlock(input())).not.toThrow()
  })

  it('accepts a timed plan', () => {
    expect(() => validateBlock(input({ planned_start: at('09:00'), planned_end: at('10:00') }))).not.toThrow()
  })

  it('requires a title', () => {
    expect(() => validateBlock(input({ title: '   ' }))).toThrow(/name/)
  })

  it('requires both times or neither', () => {
    expect(() => validateBlock(input({ planned_start: at('09:00') }))).toThrow(/both/)
  })

  it('rejects an end before the start or longer than a day', () => {
    expect(() => validateBlock(input({ planned_start: at('10:00'), planned_end: at('09:00') }))).toThrow(/after/)
    expect(() =>
      validateBlock(input({ planned_start: at('09:00'), planned_end: new Date(Date.parse(at('09:00')) + 25 * 3600000).toISOString() }))
    ).toThrow(/24 hours/)
  })

  it('rejects unknown scenes', () => {
    expect(() => validateBlock(input({ scene: 'volcano' as never }))).toThrow(/scene/)
  })
})

describe('dayBounds', () => {
  it('spans one local day', () => {
    const { start, end } = dayBounds('2026-09-24')
    expect(new Date(start).getHours()).toBe(0)
    expect(Date.parse(end) - Date.parse(start)).toBeGreaterThanOrEqual(23 * 3600000)
    expect(new Date(end).getDate()).toBe(25)
  })

  it('ends at the next local midnight on a DST change day', () => {
    const { end } = dayBounds('2026-03-08')
    expect(new Date(end).getHours()).toBe(0)
    expect(new Date(end).getDate()).toBe(9)
  })
})
