'use client'

import { useState } from 'react'
import { EntryPanel } from './entry-panel'
import { NowStack } from './now-stack'
import { TapBar, type Tap } from './tap-bar'
import { DayTimeline } from './day-timeline'
import { pillButton } from './format'
import type { useRhythm } from '@/lib/hooks/use-rhythm'
import { localDate, type DayBlock } from '@/lib/day-scenes'
import { entriesOn, findLive, occurredAt, type RhythmEntry } from '@/lib/rhythm'

export type Rhythm = ReturnType<typeof useRhythm>

/** Entries in the loaded window plus live sessions that started before it, without repeats. */
export function knownEntries(rhythm: Rhythm): RhythmEntry[] {
  const all = rhythm.entries.data ?? []
  const ids = new Set(all.map(e => e.id))
  return [...all, ...rhythm.live.filter(e => !ids.has(e.id))]
}

/** The entry panel, wired to the rhythm mutations. */
export function ConnectedEntryPanel({ rhythm, entry, ending, date, now, onClose, onError, onNotice }: {
  rhythm: Rhythm
  entry: RhythmEntry
  ending: boolean
  date: string
  now: number
  onClose: () => void
  onError: (message: string) => void
  onNotice: (message: string) => void
}) {
  const report = (e: Error) => onError(e.message)
  return (
    <EntryPanel
      key={entry.id}
      entry={entry}
      entries={knownEntries(rhythm)}
      now={now}
      ending={ending}
      pending={rhythm.edit.isPending || entry.id.startsWith('temp-')}
      onClose={onClose}
      onStartSession={() => rhythm.edit.mutate({ entry, patch: { ended_at: null } }, { onError: report })}
      onAddMark={input => rhythm.addMark.mutate({ entry_id: entry.id, ...input, at: new Date().toISOString() }, { onError: report })}
      onRemoveMark={id => rhythm.removeMark.mutate({ id, entry_id: entry.id }, { onError: report })}
      onSave={patch => {
        rhythm.edit.mutate({ entry, patch }, { onError: report })
        const movedTo = patch.occurred_at && localDate(new Date(patch.occurred_at))
        if (movedTo && movedTo !== date) {
          const label = new Date(`${movedTo}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
          onNotice(`Moved to ${label}. Go to that day to see it.`)
        }
        onClose()
      }}
    />
  )
}

/**
 * What you're doing, as it happens: what's running, the taps to log more, and the day so far
 * next to the plan.
 */
export function RhythmNow({ rhythm, date, isToday, now, blocks, onOpenBlock }: {
  rhythm: Rhythm
  date: string
  isToday: boolean
  now: number
  blocks: DayBlock[]
  onOpenBlock: (block: DayBlock) => void
}) {
  const { entries, live, log, edit, addMark } = rhythm
  const [open, setOpen] = useState<{ id: string; ending: boolean } | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const known = knownEntries(rhythm)
  const openEntry = open ? known.find(e => e.id === open.id) ?? null : null
  const report = (e: Error) => setError(e.message)
  const clear = () => {
    setError('')
    setNotice('')
  }

  async function tap(t: Tap) {
    clear()
    // Something already running takes the tap as a note, so a session isn't split in two.
    const running = isToday ? findLive(live, t.activity, t.kind, t.variant) : null
    if (running) {
      setNoteFor(running.id)
      return
    }
    try {
      const saved = await log.mutateAsync({ ...t, occurred_at: occurredAt(date, now) })
      setOpen({ id: saved.id, ending: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Please try again.')
    }
  }

  async function smoked(wave: RhythmEntry) {
    clear()
    const at = new Date().toISOString()
    try {
      await edit.mutateAsync({ entry: wave, patch: { ended_at: at } })
      const saved = await log.mutateAsync({ activity: 'smoking', kind: 'did', occurred_at: at })
      setOpen({ id: saved.id, ending: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Please try again.')
    }
  }

  if (entries.isError) {
    return (
      <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5">
        <p>Your rhythm could not be loaded.</p>
        <p className="mt-2 text-sm">{entries.error.message}</p>
        <button className={`${pillButton} mt-3`} onClick={() => entries.refetch()}>Try again</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isToday && (
        <NowStack
          live={live}
          pending={edit.isPending || addMark.isPending}
          noteFor={noteFor}
          onNoteFor={setNoteFor}
          onOpen={entry => setOpen({ id: entry.id, ending: false })}
          onAddMark={(entry, input) => addMark.mutate({ entry_id: entry.id, ...input, at: new Date().toISOString() }, { onError: report })}
          onStop={entry => {
            clear()
            setNoteFor(null)
            setOpen({ id: entry.id, ending: true })
          }}
          onSmoked={wave => void smoked(wave)}
          onEndAtLastNote={entry =>
            edit.mutate({ entry, patch: { ended_at: entry.marks?.at(-1)?.at ?? entry.occurred_at } }, { onError: report })
          }
        />
      )}

      {entries.isLoading ? (
        <p role="status">Gathering your rhythm…</p>
      ) : (
        <TapBar dayEntries={entriesOn(entries.data ?? [], date)} live={isToday ? live : []} pending={log.isPending} onTap={t => void tap(t)} />
      )}
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {openEntry && (
        <ConnectedEntryPanel
          key={`${openEntry.id}-${open?.ending}`}
          rhythm={rhythm}
          entry={openEntry}
          ending={!!open?.ending && openEntry.ended_at === null}
          date={date}
          now={now}
          onClose={() => setOpen(null)}
          onError={setError}
          onNotice={setNotice}
        />
      )}

      <DayTimeline
        date={date}
        isToday={isToday}
        now={now}
        blocks={blocks}
        entries={known}
        onOpenBlock={onOpenBlock}
        onOpenEntry={entry => {
          clear()
          setOpen({ id: entry.id, ending: false })
        }}
      />
    </div>
  )
}
