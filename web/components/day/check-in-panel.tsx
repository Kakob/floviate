'use client'

import { useEffect, useRef, useState } from 'react'
import type { CheckInKind } from '@/lib/day-scenes'

export interface CheckInContext {
  id: string | null
  title: string
}

/**
 * Records what is actually happening. Saving only writes a timestamped entry:
 * it never requests coaching, starts a timer, or changes the plan.
 */
export function CheckInPanel({
  context,
  kind,
  focusRequest,
  pending,
  notice,
  error,
  onKindChange,
  onSubmit,
}: {
  context: CheckInContext
  kind: CheckInKind
  /** Increments when another control asks to focus the text box. */
  focusRequest: number
  pending: boolean
  notice: string
  error: string
  onKindChange: (kind: CheckInKind) => void
  onSubmit: (kind: CheckInKind, text: string, context: CheckInContext) => Promise<boolean>
}) {
  const [draft, setDraft] = useState('')
  // Pin the association when writing starts, so a scene change mid-thought doesn't move it.
  const [pinned, setPinned] = useState<CheckInContext | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (focusRequest === 0) return
    setPinned(previous => previous ?? context)
    textRef.current?.focus()
    // Only react to new focus requests, not to context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const saved = await onSubmit(kind, draft, pinned ?? context)
    if (saved) {
      setDraft('')
      setPinned(null)
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="text-xl font-serif">What’s happening?</h2>
      <p className="text-sm text-stone-500 mt-1">A thought is enough. Saving it won’t ask for coaching.</p>
      <form onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="check-in-kind">
          Check-in type
        </label>
        <select
          id="check-in-kind"
          value={kind}
          onChange={e => onKindChange(e.target.value as CheckInKind)}
          className="mt-4 rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="thought">A thought or observation</option>
          <option value="changed_activity">I’m doing something else</option>
        </select>
        <label className="sr-only" htmlFor="day-thought">
          Your check-in
        </label>
        <textarea
          id="day-thought"
          ref={textRef}
          maxLength={10000}
          required
          value={draft}
          onChange={e => {
            setDraft(e.target.value)
            setPinned(previous => previous ?? context)
          }}
          rows={4}
          placeholder={
            kind === 'changed_activity'
              ? 'What are you doing instead? “I don’t know” is okay too.'
              : 'Anything on your mind…'
          }
          className="mt-3 w-full rounded-xl border border-stone-300 p-3 text-sm"
        />
        <p className="text-xs text-stone-500 mb-3">
          Recorded now · attached to {(pinned ?? context).title}
          {pinned && pinned.id !== context.id && (
            <button type="button" className="ml-2 underline" onClick={() => setPinned(context)}>
              attach to {context.title} instead
            </button>
          )}
        </p>
        <button
          disabled={pending || !draft.trim()}
          className="rounded-full bg-stone-800 px-5 py-2 text-sm text-white disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save check-in'}
        </button>
      </form>
      {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  )
}
