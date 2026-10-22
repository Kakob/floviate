// Planning many days at once: week ranges, placing blocks on a 24-hour grid, copying days.
// Pure: no React or Supabase.

import { isTimed, localDate, type DayBlock, type DayBlockInput } from '@/lib/day-scenes'
import { MINUTES_PER_DAY, clamp } from '@/lib/time-grid'

/** Local date string `n` days after `date`. Calendar arithmetic, so DST never shifts the day. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

/** The Monday-to-Sunday week containing `date`. */
export function weekDates(date: string): string[] {
  const d = new Date(`${date}T12:00:00`)
  const offset = (d.getDay() + 6) % 7
  const monday = addDays(date, -offset)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** ISO timestamp for `min` minutes into the local day `date`. */
export function atMinutes(date: string, min: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setHours(Math.floor(min / 60), min % 60, 0, 0)
  return d.toISOString()
}

/** Minutes since local midnight of `date`, as a wall-clock reading (DST-safe). */
function wallMinutes(iso: string, date: string): number {
  const t = new Date(iso)
  const dayDiff = Math.round((Date.parse(`${localDate(t)}T12:00:00`) - Date.parse(`${date}T12:00:00`)) / 86400000)
  return dayDiff * MINUTES_PER_DAY + t.getHours() * 60 + t.getMinutes()
}

/** Where a timed block sits in its day's column, clamped to that day. Null for untimed blocks. */
export function blockSpan(block: DayBlock): { startMin: number; endMin: number } | null {
  if (!isTimed(block)) return null
  const startMin = clamp(wallMinutes(block.planned_start, block.plan_date), 0, MINUTES_PER_DAY - 15)
  const endMin = clamp(wallMinutes(block.planned_end, block.plan_date), startMin + 15, MINUTES_PER_DAY)
  return { startMin, endMin }
}

/** The fields to save when a block is placed at [startMin, endMin) on `date`. */
export function placeBlock(block: DayBlock, date: string, startMin: number, endMin: number): DayBlockInput {
  return {
    plan_date: date,
    title: block.title,
    intention: block.intention,
    scene: block.scene,
    item_id: block.item_id,
    planned_start: atMinutes(date, startMin),
    planned_end: atMinutes(date, endMin),
  }
}

/**
 * New plans for `targets` that repeat `blocks` (from a single source day) at the same wall-clock times.
 * Skipped plans aren't copied. Copies start as ordinary plans after anything already on the target day.
 */
export function copyDayTo(
  blocks: DayBlock[],
  targets: { date: string; nextPosition: number }[]
): (DayBlockInput & { position: number })[] {
  const source = blocks.filter(b => b.status !== 'skipped').sort((a, b) => a.position - b.position)
  return targets.flatMap(({ date, nextPosition }) =>
    source.map((block, i) => {
      let planned_start: string | null = null
      let planned_end: string | null = null
      if (isTimed(block)) {
        // Same wall-clock start; same length, even if it runs past midnight.
        planned_start = atMinutes(date, wallMinutes(block.planned_start, block.plan_date))
        planned_end = new Date(Date.parse(planned_start) + Date.parse(block.planned_end) - Date.parse(block.planned_start)).toISOString()
      }
      return {
        plan_date: date,
        title: block.title,
        intention: block.intention,
        scene: block.scene,
        item_id: block.item_id,
        planned_start,
        planned_end,
        position: nextPosition + i,
      }
    })
  )
}
