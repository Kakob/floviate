'use client'

import { useState } from 'react'
import { addDays } from '@/lib/day-planner'
import { pillButton } from './format'

const label = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

const isWeekday = (date: string) => {
  const day = new Date(`${date}T12:00:00`).getDay()
  return day !== 0 && day !== 6
}

/**
 * Copy a day onto chosen days, or a week onto following weeks. Copies are independent plans:
 * changing or skipping one never touches the others.
 */
export function CopyDaysPanel({
  mode,
  source,
  planCount,
  pending,
  onCopy,
  onClose,
}: {
  mode: 'day' | 'week'
  /** The day being copied, or the week's first day. */
  source: string
  planCount: number
  pending: boolean
  onCopy: (targets: string[] | number) => void
  onClose: () => void
}) {
  const upcoming = Array.from({ length: 14 }, (_, i) => addDays(source, i + 1))
  const [picked, setPicked] = useState<Set<string>>(() => new Set([upcoming[0]]))
  const [weeks, setWeeks] = useState(1)

  const toggle = (date: string) =>
    setPicked(previous => {
      const next = new Set(previous)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="font-medium text-lg">{mode === 'day' ? `Copy ${label(source)}` : 'Copy this week'}</h2>
        <p className="text-sm text-stone-500 mt-1">
          {planCount} {planCount === 1 ? 'plan' : 'plans'} at the same times. Skipped plans aren’t copied. Each copy can be
          changed on its own.
        </p>
      </div>
      {mode === 'day' ? (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <button className="underline" onClick={() => setPicked(new Set(upcoming.slice(0, 7).filter(isWeekday)))}>
              Weekdays this coming week
            </button>
            <button className="underline" onClick={() => setPicked(new Set(upcoming.slice(0, 7)))}>
              Next 7 days
            </button>
            <button className="underline" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {upcoming.map(date => (
              <label
                key={date}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                  picked.has(date) ? 'border-emerald-800 bg-emerald-50' : 'border-stone-200'
                }`}
              >
                <input type="checkbox" checked={picked.has(date)} onChange={() => toggle(date)} />
                {label(date)}
              </label>
            ))}
          </div>
        </>
      ) : (
        <label className="block text-sm">
          Repeat it for the next
          <select
            value={weeks}
            onChange={e => setWeeks(Number(e.target.value))}
            className="ml-2 rounded-lg border border-stone-300 px-2 py-1"
          >
            {[1, 2, 3, 4, 8].map(n => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'week' : 'weeks'}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-3">
        <button
          disabled={pending || !planCount || (mode === 'day' && !picked.size)}
          onClick={() => onCopy(mode === 'day' ? Array.from(picked).sort() : weeks)}
          className="rounded-full bg-stone-800 px-5 py-2 text-sm text-white disabled:opacity-40"
        >
          {pending ? 'Copying…' : mode === 'day' ? `Copy to ${picked.size} ${picked.size === 1 ? 'day' : 'days'}` : 'Copy'}
        </button>
        <button onClick={onClose} className={pillButton}>
          Cancel
        </button>
      </div>
    </div>
  )
}
