'use client'

import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { DayBlock, SceneSelection } from '@/lib/day-scenes'
import { blockStatusLabel, blockTimeLabel, pillButton } from './format'

/** The zoomed-out day: planned scenes in order. Selecting one revisits it; nothing here records activity. */
export function DayStrip({
  blocks,
  visibleId,
  currentId,
  selection,
  now,
  movePending,
  onSelect,
  onMove,
  onAdd,
}: {
  blocks: DayBlock[]
  visibleId: string | null
  currentId: string | null
  selection: SceneSelection
  now: number
  movePending: boolean
  onSelect: (selection: SceneSelection) => void
  onMove: (id: string, direction: -1 | 1) => void
  onAdd: () => void
}) {
  const shownIndex = blocks.findIndex(b => b.id === visibleId)
  const selectIndex = (index: number) => onSelect({ kind: 'block', id: blocks[index].id })

  return (
    <section aria-label="Day timeline" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-serif">The shape of your day</h2>
        <button className={pillButton} onClick={onAdd}>
          <Plus size={14} className="inline mr-1" />
          Add a plan
        </button>
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-2">
        {blocks.map((block, index) => {
          const selected = visibleId === block.id
          return (
            <li
              key={block.id}
              className={`min-w-[170px] max-w-[240px] shrink-0 rounded-xl border ${
                selected ? 'border-emerald-800 bg-emerald-50' : 'border-stone-200 bg-white hover:border-stone-400'
              } ${block.status !== 'planned' ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => onSelect({ kind: 'block', id: block.id })}
                aria-pressed={selected}
                className="block w-full p-4 pb-2 text-left"
              >
                <span className="block text-xs text-stone-500">{blockTimeLabel(block)}</span>
                <span className="block mt-1 truncate">{block.title}</span>
                <span className="block mt-2 text-xs text-stone-500">{blockStatusLabel(block, currentId, now)}</span>
              </button>
              <div className="flex justify-end gap-1 px-2 pb-2">
                <button
                  aria-label={`Move ${block.title} earlier`}
                  disabled={movePending || index === 0}
                  onClick={() => onMove(block.id, -1)}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  aria-label={`Move ${block.title} later`}
                  disabled={movePending || index === blocks.length - 1}
                  onClick={() => onMove(block.id, 1)}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </li>
          )
        })}
        {!blocks.length && (
          <li className="text-sm text-stone-500 py-3">No plans for this day. Meals, walks, work, and rest all belong here.</li>
        )}
      </ol>
      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
        <button
          aria-label="Previous scene"
          disabled={shownIndex <= 0}
          onClick={() => selectIndex(shownIndex - 1)}
          className="p-2 rounded border disabled:opacity-30"
        >
          <ArrowLeft size={15} />
        </button>
        <button
          aria-label="Next scene"
          disabled={!blocks.length || shownIndex >= blocks.length - 1}
          onClick={() => selectIndex(shownIndex + 1)}
          className="p-2 rounded border disabled:opacity-30"
        >
          <ArrowRight size={15} />
        </button>
        <button
          className={`underline ${selection.kind === 'unplanned' ? 'text-emerald-800' : ''}`}
          aria-pressed={selection.kind === 'unplanned'}
          onClick={() => onSelect({ kind: 'unplanned' })}
        >
          Unplanned thoughts
        </button>
        <span>Plans describe intention. Only check-ins describe what you recorded.</span>
      </div>
    </section>
  )
}
