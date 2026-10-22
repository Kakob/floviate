'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { RhythmTrends } from './rhythm-trends'
import { ConnectedEntryPanel, knownEntries, type Rhythm } from './rhythm-now'
import { formatTime, pillButton } from './format'
import {
  MOMENTS,
  durationMs,
  entriesOn,
  entryLabel,
  entryState,
  feelingKey,
  formatDuration,
  hasFeelings,
  noteKey,
  type RhythmEntry,
} from '@/lib/rhythm'

/** "before 2 · after 4" for the entry list; empty when nothing was rated. */
function feelingLine(entry: RhythmEntry) {
  return MOMENTS.filter(({ value }) => entry[feelingKey(value)] !== null)
    .map(({ value }) => `${value} ${entry[feelingKey(value)]}`)
    .join(' · ')
}

function whenLine(entry: RhythmEntry, now: number) {
  const state = entryState(entry)
  if (state === 'moment') return formatTime(entry.occurred_at)
  const end = state === 'live' ? 'now' : formatTime(entry.ended_at!)
  return `${formatTime(entry.occurred_at)}–${end} · ${formatDuration(durationMs(entry, now))}`
}

/** Everything logged on the day, newest first, then the four-week trends. */
export function RhythmHistory({ rhythm, date, now }: { rhythm: Rhythm; date: string; now: number }) {
  const { entries, peaks, remove } = rhythm
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const all = entries.data ?? []
  const onDay = entriesOn(all, date)
  const open = openId ? knownEntries(rhythm).find(e => e.id === openId) ?? null : null

  if (entries.isLoading) return <p role="status">Gathering your rhythm…</p>
  if (entries.isError) {
    return (
      <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5">
        <p>Your rhythm could not be loaded.</p>
        <p className="text-sm mt-2">{entries.error.message}</p>
        <button className={`${pillButton} mt-3`} onClick={() => entries.refetch()}>Try again</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {open && (
        <ConnectedEntryPanel
          rhythm={rhythm}
          entry={open}
          ending={false}
          date={date}
          now={now}
          onClose={() => setOpenId(null)}
          onError={setError}
          onNotice={setNotice}
        />
      )}

      <section className="rounded-2xl border border-stone-200 bg-[#f5f3ed] p-5">
        <h2 className="text-xl font-serif">On this day</h2>
        {!onDay.length ? (
          <p className="mt-3 text-sm text-stone-500">Nothing logged yet.</p>
        ) : (
          <ol className="mt-4 space-y-3 max-h-[32rem] overflow-y-auto">
            {onDay.map(entry => (
              <li key={entry.id} className="flex items-start justify-between gap-3 border-l-2 border-stone-300 pl-3">
                <button
                  className="min-w-0 text-left"
                  onClick={() => {
                    setError('')
                    setNotice('')
                    setOpenId(entry.id)
                  }}
                >
                  <p className="text-xs text-stone-500">
                    {whenLine(entry, now)}
                    {feelingLine(entry) && ` · felt ${feelingLine(entry)}`}
                    {!!entry.marks?.length && ` · ${entry.marks.length} note${entry.marks.length === 1 ? '' : 's'} during`}
                  </p>
                  <p className="text-sm">{entryLabel(entry)}</p>
                  {MOMENTS.filter(({ value }) => entry[noteKey(value)]).map(({ value, label }) => (
                    <p key={value} className="text-sm text-stone-600 whitespace-pre-wrap break-words">
                      <span className="text-stone-400">{label}: </span>
                      {entry[noteKey(value)]}
                    </p>
                  ))}
                  {entry.done_note && (
                    <p className="text-sm text-stone-600 whitespace-pre-wrap break-words">
                      <span className="text-stone-400">Got done: </span>
                      {entry.done_note}
                    </p>
                  )}
                  {entry.tallies.length > 0 && (
                    <p className="text-sm text-stone-600">{entry.tallies.map(t => [t.label, t.value, t.unit].filter(Boolean).join(' ')).join(' · ')}</p>
                  )}
                  <p className="text-xs text-stone-400 underline">
                    {hasFeelings(entry) || entry.done_note || entry.tallies.length ? 'Edit' : 'Add how it felt or fix the time'}
                  </p>
                </button>
                <button
                  aria-label={`Remove ${entryLabel(entry)} at ${formatTime(entry.occurred_at)}`}
                  disabled={remove.isPending || entry.id.startsWith('temp-')}
                  onClick={() => {
                    if (openId === entry.id) setOpenId(null)
                    remove.mutate(entry.id, { onError: e => setError(e.message) })
                  }}
                  className="rounded-full p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <RhythmTrends
        entries={all}
        endDate={date}
        allTime={peaks.isError ? { status: 'error' } : peaks.data ? { status: 'ready', peaks: peaks.data } : { status: 'loading' }}
      />
    </div>
  )
}
