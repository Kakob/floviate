'use client'

import { useEffect, useState } from 'react'
import { formatTime, pillButton } from './format'
import { MarkComposer, markScale } from './entry-panel'
import { durationMs, entryLabel, formatDuration, isStale, type RhythmEntry } from '@/lib/rhythm'

/** Re-renders every second, only for the timers. */
function useSecondTick() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/**
 * Everything running right now, side by side. Each session can take a quick note, or be stopped.
 * A craving can end two ways: it passed, or you smoked.
 */
export function NowStack({ live, pending, noteFor, onNoteFor, onOpen, onAddMark, onStop, onSmoked, onEndAtLastNote }: {
  live: RhythmEntry[]
  pending: boolean
  /** The session whose quick note is open, if any. */
  noteFor: string | null
  onNoteFor: (id: string | null) => void
  onOpen: (entry: RhythmEntry) => void
  onAddMark: (entry: RhythmEntry, input: { level: number | null; note: string }) => void
  onStop: (entry: RhythmEntry) => void
  onSmoked: (entry: RhythmEntry) => void
  onEndAtLastNote: (entry: RhythmEntry) => void
}) {
  const now = useSecondTick()
  if (!live.length) return null

  return (
    <section aria-label="Happening now" className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
      <h2 className="text-xs uppercase tracking-[.2em] text-emerald-900">Happening now</h2>
      <ul className="mt-3 space-y-3">
        {live.map(entry => {
          const last = entry.marks?.at(-1)
          const scale = markScale(entry.kind)
          const stale = isStale(entry, now)
          return (
            <li key={entry.id} className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => onOpen(entry)}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-600 animate-pulse" aria-hidden />
                  <span className="font-medium">{entryLabel(entry)}</span>
                  <span className="ml-2 font-serif text-lg tabular-nums" aria-label="Running for">
                    {formatDuration(durationMs(entry, now))}
                  </span>
                  <span className="ml-2 text-xs text-stone-500">since {formatTime(entry.occurred_at)}</span>
                </button>
                <div className="flex flex-wrap gap-2">
                  <button className={pillButton} onClick={() => onNoteFor(noteFor === entry.id ? null : entry.id)}>
                    + Note
                  </button>
                  {entry.kind === 'urge' ? (
                    <>
                      <button disabled={pending} className={pillButton} onClick={() => onStop(entry)}>It passed</button>
                      <button disabled={pending} className={pillButton} onClick={() => onSmoked(entry)}>I smoked</button>
                    </>
                  ) : (
                    <button disabled={pending} className="rounded-full bg-stone-800 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => onStop(entry)}>
                      Stop
                    </button>
                  )}
                </div>
              </div>
              {last && (
                <p className="mt-1.5 truncate text-sm text-stone-600">
                  <span className="text-xs text-stone-400">{formatTime(last.at)} </span>
                  {last.level !== null && `${scale.name.toLowerCase()} ${last.level} `}
                  {last.note}
                  {(entry.marks?.length ?? 0) > 1 && <span className="text-xs text-stone-400"> · {entry.marks!.length} notes</span>}
                </p>
              )}
              {stale && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Still going? It’s been running a long time.{' '}
                  <button disabled={pending} className="underline" onClick={() => onEndAtLastNote(entry)}>
                    {last ? `End it at the last note (${formatTime(last.at)})` : 'End it where it started'}
                  </button>
                </p>
              )}
              {noteFor === entry.id && (
                <div className="mt-3 border-t border-stone-100 pt-3">
                  <MarkComposer entry={entry} pending={pending} autoFocus onAdd={input => onAddMark(entry, input)} onDone={() => onNoteFor(null)} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
