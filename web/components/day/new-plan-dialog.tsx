'use client'

import { useState } from 'react'
import type { ScenePreset } from '@/lib/day-scenes'
import { Modal } from './modal'
import { ScenePicker } from './scene-picker'

/** Making a plan is choosing a scene. Name, context, and time can come later. */
export function NewPlanDialog({
  when,
  onCreate,
  onClose,
}: {
  /** Describes where the plan will go, e.g. "Saturday, 2–4 AM" or "Next in today’s order". */
  when: string
  onCreate: (scene: ScenePreset) => Promise<void>
  onClose: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function pick(scene: ScenePreset) {
    setPending(true)
    setError('')
    try {
      await onCreate(scene)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make that plan.')
      setPending(false)
    }
  }

  return (
    <Modal label="Choose a scene" wide onClose={onClose}>
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-lg">What will this look like?</h2>
            <p className="text-sm text-stone-500">{when} · pick a scene, add details whenever you know them</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-sm text-stone-500 underline">
            Cancel
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <ScenePicker disabled={pending} onPick={scene => void pick(scene)} />
        </div>
      </div>
    </Modal>
  )
}
