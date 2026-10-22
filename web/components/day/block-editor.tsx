'use client'

import { useState } from 'react'
import { localDate, type DayBlock, type DayBlockInput, type ScenePreset } from '@/lib/day-scenes'
import { SCENE_PRESETS } from './scenes'
import { ScenePicker } from './scene-picker'

function localInput(iso: string) {
  const date = new Date(iso)
  return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function defaultStart(date: string) {
  return `${date}T${String(new Date().getHours()).padStart(2, '0')}:00`
}

const field = 'mt-1 w-full rounded-lg border border-stone-300 bg-white p-2.5 text-stone-800'

/**
 * Details for a plan that already exists. The scene is the plan; everything here is optional
 * and can be filled in whenever it becomes clear.
 */
export function BlockEditor({
  block,
  pending,
  onSave,
  onRemove,
  onClose,
}: {
  block: DayBlock
  pending: boolean
  onSave: (input: DayBlockInput) => Promise<void>
  /** The server refuses if the plan has check-ins. */
  onRemove?: () => Promise<void>
  onClose: () => void
}) {
  const [scene, setScene] = useState<ScenePreset>(block.scene)
  // A plan named after its scene keeps following the scene until the user names it.
  const [title, setTitle] = useState(block.title === SCENE_PRESETS[block.scene]?.label ? '' : block.title)
  const [intention, setIntention] = useState(block.intention)
  const [timed, setTimed] = useState(block.planned_start !== null)
  const [start, setStart] = useState(block.planned_start ? localInput(block.planned_start) : defaultStart(block.plan_date))
  const [end, setEnd] = useState(
    block.planned_end
      ? localInput(block.planned_end)
      : localInput(new Date(Date.parse(defaultStart(block.plan_date)) + 3600000).toISOString())
  )
  const [showScenes, setShowScenes] = useState(false)
  const [error, setError] = useState('')
  const sceneLabel = SCENE_PRESETS[scene]?.label ?? SCENE_PRESETS.quiet.label

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await onSave({
        // A timed plan belongs to the day it starts on.
        plan_date: timed ? start.slice(0, 10) : block.plan_date,
        title: title.trim() || sceneLabel,
        intention: intention.trim(),
        planned_start: timed ? new Date(start).toISOString() : null,
        planned_end: timed ? new Date(end).toISOString() : null,
        scene,
        item_id: block.item_id,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Your draft is still here.')
    }
  }

  return (
    <form className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4" onSubmit={handleSubmit}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-lg">{title.trim() || sceneLabel}</h2>
          <p className="text-sm text-stone-500">Add whatever you know now. The rest can wait.</p>
        </div>
        <button type="button" onClick={() => setShowScenes(s => !s)} className="shrink-0 text-sm text-stone-500 underline">
          {showScenes ? 'Done choosing' : 'Change scene'}
        </button>
      </div>

      {showScenes && (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-100 p-2">
          <ScenePicker
            compact
            value={scene}
            onPick={next => {
              setScene(next)
              setShowScenes(false)
            }}
          />
        </div>
      )}

      <label className="block text-sm">
        Name <span className="text-stone-500">· optional</span>
        <input maxLength={200} placeholder={sceneLabel} className={field} value={title} onChange={e => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm">
        What you’d like from it <span className="text-stone-500">· optional</span>
        <textarea
          maxLength={4000}
          placeholder="One memory for the essay. It doesn’t need to be finished today."
          className={field}
          rows={2}
          value={intention}
          onChange={e => setIntention(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />
        Give it a time <span className="text-stone-500">· optional</span>
      </label>
      {timed && (
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">
            Start
            <input required type="datetime-local" className={field} value={start} onChange={e => setStart(e.target.value)} />
          </label>
          <label className="text-sm">
            End
            <input required type="datetime-local" className={field} value={end} onChange={e => setEnd(e.target.value)} />
          </label>
        </div>
      )}
      <p className="text-xs text-stone-500">
        {timed
          ? 'While this time is happening, this scene shows. If plans overlap, the one that starts later wins.'
          : 'Without a time, this shows when it’s next in your order and nothing timed is happening.'}
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-full bg-stone-800 px-5 py-2 text-white disabled:opacity-50">
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" disabled={pending} onClick={onClose} className="px-3 py-2">
          Cancel
        </button>
        {onRemove && (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setError('')
              try {
                await onRemove()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not remove this plan.')
              }
            }}
            className="ml-auto px-3 py-2 text-sm text-stone-500 underline"
          >
            Remove
          </button>
        )}
      </div>
    </form>
  )
}
