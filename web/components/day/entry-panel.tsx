'use client'

import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { formatTime, pillButton } from './format'
import {
  FEELINGS,
  MOMENTS,
  cleanTallies,
  durationMs,
  entryLabel,
  entryState,
  feelingKey,
  formatDuration,
  fromLocalInput,
  lastTallies,
  noteKey,
  preparePatch,
  toLocalInput,
  validateMark,
  type RhythmEntry,
  type RhythmFeelings,
  type RhythmKind,
  type RhythmMoment,
  type RhythmPatch,
  type RhythmTally,
} from '@/lib/rhythm'

const PROMPTS: Record<RhythmKind, Record<RhythmMoment, string>> = {
  did: {
    before: 'What led up to it?',
    during: 'What was it like?',
    after: 'How did it leave you?',
  },
  urge: {
    before: 'What set it off?',
    during: 'How strong was it?',
    after: 'What did you do instead?',
  },
}

const chip = (on: boolean) =>
  `h-8 w-8 rounded-full border text-sm ${on ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white hover:bg-stone-100'}`

/** What a mark's 1-5 means: how strong an urge is, or how you feel. */
export const markScale = (kind: RhythmKind) =>
  kind === 'urge'
    ? { name: 'Strength', labels: ['Faint', 'Mild', 'Noticeable', 'Strong', 'Overwhelming'] }
    : { name: 'Feeling', labels: FEELINGS.map(f => f.label) }

/** A quick note during a session: a 1-5 level, a few words, or both. */
export function MarkComposer({ entry, pending, autoFocus, onAdd, onDone }: {
  entry: RhythmEntry
  pending: boolean
  autoFocus?: boolean
  onAdd: (input: { level: number | null; note: string }) => void
  onDone?: () => void
}) {
  const [level, setLevel] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState('')
  const scale = markScale(entry.kind)

  function add() {
    try {
      validateMark({ level, note })
    } catch (e) {
      return setProblem(e instanceof Error ? e.message : 'Check the note and try again.')
    }
    onAdd({ level, note })
    setLevel(null)
    setNote('')
    setProblem('')
    onDone?.()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-stone-500">{scale.name}</span>
        {scale.labels.map((label, i) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={`${scale.name}: ${i + 1}, ${label}`}
            aria-pressed={level === i + 1}
            className={chip(level === i + 1)}
            onClick={() => setLevel(level === i + 1 ? null : i + 1)}
          >
            {i + 1}
          </button>
        ))}
        <span className="ml-1 text-xs text-stone-500">{level !== null && scale.labels[level - 1]}</span>
      </div>
      <div className="flex gap-2">
        <input
          autoFocus={autoFocus}
          aria-label="Note"
          maxLength={2000}
          value={note}
          onChange={e => {
            setNote(e.target.value)
            setProblem('')
          }}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={entry.kind === 'urge' ? 'What’s going on right now?' : 'A thought, a feeling, a small win…'}
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm"
        />
        <button disabled={pending} className="rounded-full bg-stone-800 px-4 py-1.5 text-sm text-white disabled:opacity-40" onClick={add}>
          Add
        </button>
        {onDone && (
          <button aria-label="Close note" className="rounded-full p-1.5 text-stone-500 hover:bg-stone-200" onClick={onDone}>
            <X size={14} />
          </button>
        )}
      </div>
      {problem && <p role="alert" className="text-xs text-red-700">{problem}</p>}
    </div>
  )
}

function MarkList({ entry, onRemove }: { entry: RhythmEntry; onRemove: (id: string) => void }) {
  const marks = entry.marks ?? []
  const scale = markScale(entry.kind)
  if (!marks.length) return <p className="text-sm text-stone-500">No notes during it yet.</p>
  return (
    <ol className="space-y-1.5">
      {marks.map(mark => (
        <li key={mark.id} className="flex items-start justify-between gap-2 text-sm">
          <p className="min-w-0">
            <time dateTime={mark.at} className="text-xs text-stone-500">{formatTime(mark.at)}</time>
            {mark.level !== null && (
              <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs">
                {scale.name.toLowerCase()} {mark.level} · {scale.labels[mark.level - 1]}
              </span>
            )}
            {mark.note && <span className="ml-2 whitespace-pre-wrap break-words">{mark.note}</span>}
          </p>
          <button
            aria-label={`Remove note at ${formatTime(mark.at)}`}
            disabled={mark.id.startsWith('temp-')}
            onClick={() => onRemove(mark.id)}
            className="rounded-full p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-40"
          >
            <Trash2 size={12} />
          </button>
        </li>
      ))}
    </ol>
  )
}

function TallyRows({ rows, onChange }: { rows: RhythmTally[]; onChange: (rows: RhythmTally[]) => void }) {
  const set = (i: number, patch: Partial<RhythmTally>) => onChange(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const field = 'min-w-0 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm'
  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_6rem_6rem_auto] gap-1.5">
          <input aria-label={`Row ${i + 1}: what`} placeholder="What (Bench, Pages…)" maxLength={80} value={row.label} onChange={e => set(i, { label: e.target.value })} className={field} />
          <input aria-label={`Row ${i + 1}: how many`} placeholder="3x8" maxLength={80} value={row.value} onChange={e => set(i, { value: e.target.value })} className={field} />
          <input aria-label={`Row ${i + 1}: unit or weight`} placeholder="135 lb" maxLength={40} value={row.unit} onChange={e => set(i, { unit: e.target.value })} className={field} />
          <button aria-label={`Remove row ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700">
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={rows.length >= 30}
        onClick={() => onChange([...rows, { label: '', value: '', unit: '' }])}
        className="inline-flex items-center gap-1 text-xs text-stone-600 underline disabled:opacity-40"
      >
        <Plus size={12} /> Add a row
      </button>
    </div>
  )
}

/**
 * Everything about one entry. A moment gets feelings for before, during, and after, and can be
 * turned into a session. A session gets before and after, the notes made while it ran, and, once
 * ended (or while `ending`), how long it took and what got done. Every part is optional.
 */
export function EntryPanel({ entry, entries, now, ending = false, pending, onSave, onStartSession, onAddMark, onRemoveMark, onClose }: {
  entry: RhythmEntry
  /** Recent entries, to offer the last session's tallies. */
  entries: RhythmEntry[]
  now: number
  /** Opened from Stop: show the end fields, defaulting to now. */
  ending?: boolean
  pending: boolean
  onSave: (patch: RhythmPatch) => void
  onStartSession: () => void
  onAddMark: (input: { level: number | null; note: string }) => void
  onRemoveMark: (id: string) => void
  onClose: () => void
}) {
  const state = entryState(entry)
  const isSession = state !== 'moment'
  const showEnd = state === 'session' || ending
  const moments = isSession ? MOMENTS.filter(m => m.value !== 'during') : MOMENTS

  const original: RhythmFeelings = {
    feeling_before: entry.feeling_before, feeling_during: entry.feeling_during, feeling_after: entry.feeling_after,
    note_before: entry.note_before, note_during: entry.note_during, note_after: entry.note_after,
  }
  const [feelings, setFeelings] = useState(original)
  const originalWhen = toLocalInput(entry.occurred_at)
  const [when, setWhen] = useState(originalWhen)
  const originalEnd = toLocalInput(entry.ended_at ?? new Date(now).toISOString())
  const [endWhen, setEndWhen] = useState(originalEnd)
  const [doneNote, setDoneNote] = useState(entry.done_note)
  const [tallies, setTallies] = useState<RhythmTally[]>(() =>
    entry.tallies.length || !ending ? entry.tallies : lastTallies(entries, entry.activity, entry.variant, entry.id)
  )
  const [problem, setProblem] = useState('')

  const unchanged =
    !ending &&
    when === originalWhen &&
    endWhen === originalEnd &&
    doneNote === entry.done_note &&
    JSON.stringify(tallies) === JSON.stringify(entry.tallies) &&
    MOMENTS.every(({ value }) =>
      feelings[feelingKey(value)] === original[feelingKey(value)] && feelings[noteKey(value)] === original[noteKey(value)]
    )
  const set = (patch: Partial<RhythmFeelings>) => {
    setFeelings(f => ({ ...f, ...patch }))
    setProblem('')
  }

  function save() {
    const patch: RhythmPatch = {
      ...feelings,
      note_before: feelings.note_before.trim(),
      note_during: feelings.note_during.trim(),
      note_after: feelings.note_after.trim(),
    }
    // Only send times that changed, so an untouched entry keeps its exact seconds.
    if (when !== originalWhen) {
      const at = fromLocalInput(when)
      if (!at) return setProblem('Choose when it started.')
      patch.occurred_at = at
    }
    if (showEnd) {
      if (ending || endWhen !== originalEnd) {
        const at = ending && endWhen === originalEnd ? new Date(Math.max(now, Date.parse(patch.occurred_at ?? entry.occurred_at))).toISOString() : fromLocalInput(endWhen)
        if (!at) return setProblem('Choose when it ended.')
        patch.ended_at = at
      }
      patch.done_note = doneNote.trim()
      patch.tallies = cleanTallies(tallies)
    }
    try {
      preparePatch(entry, patch, Date.now())
    } catch (e) {
      return setProblem(e instanceof Error ? e.message : 'Check the details and try again.')
    }
    onSave(patch)
  }

  const badge =
    state === 'live'
      ? `Live · ${formatDuration(durationMs(entry, now))}`
      : state === 'session'
        ? `Session · ${formatDuration(durationMs(entry, now))}`
        : 'Moment'

  return (
    <section aria-label="Entry details" className="rounded-2xl border border-stone-300 bg-[#f5f3ed] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-serif">
          {entryLabel(entry)}
          <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-sans ${state === 'live' ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-200 text-stone-600'}`}>
            {badge}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span>{isSession ? 'Started' : 'Happened at'}</span>
            <input
              type="datetime-local"
              value={when}
              max={toLocalInput(new Date(now).toISOString())}
              onChange={e => {
                setWhen(e.target.value)
                setProblem('')
              }}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1"
            />
          </label>
          {showEnd && (
            <label className="flex items-center gap-2">
              <span>Ended</span>
              <input
                type="datetime-local"
                value={endWhen}
                max={toLocalInput(new Date(now).toISOString())}
                onChange={e => {
                  setEndWhen(e.target.value)
                  setProblem('')
                }}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1"
              />
            </label>
          )}
        </div>
      </div>

      {state === 'moment' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-3 text-sm">
          <span className="text-stone-600">
            {entry.kind === 'urge' ? 'Still feeling it? Ride it out as a session and note how it changes.' : 'Still going? Keep it running and note things as they happen.'}
          </span>
          <button disabled={pending} className="rounded-full bg-emerald-800 px-4 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-40" onClick={onStartSession}>
            Start session
          </button>
        </div>
      )}

      <p className="mt-4 text-sm text-stone-500">How did you feel? Fill in any, all, or none. 1 is rough, 5 is great.</p>
      <div className={`mt-3 grid gap-5 ${moments.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {moments.map(({ value: moment, label }) => {
          const feeling = feelings[feelingKey(moment)]
          return (
            <fieldset key={moment} className="min-w-0">
              <legend className="text-sm font-medium">{label}</legend>
              <div className="mt-2 flex gap-1.5">
                {FEELINGS.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    title={f.label}
                    aria-label={`${label}: ${f.value}, ${f.label}`}
                    aria-pressed={feeling === f.value}
                    className={chip(feeling === f.value)}
                    onClick={() => set({ [feelingKey(moment)]: feeling === f.value ? null : f.value })}
                  >
                    {f.value}
                  </button>
                ))}
              </div>
              <p className="mt-1 h-4 text-xs text-stone-500">{feeling !== null && FEELINGS[feeling - 1].label}</p>
              <textarea
                aria-label={`${label} note`}
                rows={2}
                maxLength={2000}
                value={feelings[noteKey(moment)]}
                onChange={e => set({ [noteKey(moment)]: e.target.value })}
                placeholder={PROMPTS[entry.kind][moment]}
                className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm"
              />
            </fieldset>
          )
        })}
      </div>

      {isSession && (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-medium">During</h3>
          {/* Older entries may have a single "during" note from before sessions existed. */}
          {(entry.feeling_during !== null || entry.note_during) && (
            <p className="text-sm text-stone-600">
              {entry.feeling_during !== null && `Felt ${entry.feeling_during} · `}
              {entry.note_during}
            </p>
          )}
          <MarkList entry={entry} onRemove={onRemoveMark} />
          {state === 'live' && <MarkComposer entry={entry} pending={pending} onAdd={onAddMark} />}
        </div>
      )}

      {showEnd && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">What got done</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={doneNote}
              onChange={e => {
                setDoneNote(e.target.value)
                setProblem('')
              }}
              placeholder={entry.kind === 'urge' ? 'How it passed, what helped…' : 'What you finished, practiced, or figured out'}
              className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm"
            />
          </label>
          <div>
            <span className="text-sm font-medium">Tallies</span>
            <p className="mb-1.5 text-xs text-stone-500">Sets, reps, weight, pages, songs… whatever is worth counting.</p>
            <TallyRows rows={tallies} onChange={rows => {
              setTallies(rows)
              setProblem('')
            }} />
          </div>
        </div>
      )}

      {problem && <p role="alert" className="mt-2 text-sm text-red-700">{problem}</p>}
      <div className="mt-4 flex gap-2">
        <button
          disabled={pending || unchanged}
          className="rounded-full bg-stone-800 px-5 py-2 text-sm text-white disabled:opacity-40"
          onClick={save}
        >
          {ending ? 'End session' : 'Save'}
        </button>
        <button className={pillButton} onClick={onClose}>
          {unchanged ? 'Close' : 'Cancel'}
        </button>
      </div>
    </section>
  )
}
