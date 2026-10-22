'use client'

import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { nextPosition, type DayBlock } from '@/lib/day-scenes'
import { addDays, atMinutes, placeBlock, weekDates } from '@/lib/day-planner'
import { useDayBlockMutations, useDayRange } from '@/lib/hooks/use-day-planner'
import { PlanGrid } from './plan-grid'
import { BlockEditor } from './block-editor'
import { CopyDaysPanel } from './copy-days-panel'
import { Modal } from './modal'
import { NewPlanDialog } from './new-plan-dialog'
import { planFromScene } from './scene-picker'
import { pillButton } from './format'

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

type Editor = { kind: 'new'; date: string; start: string; end: string } | { kind: 'edit'; id: string }

/** Arrange plans visually for a day or a week. Planning only: nothing here records what happened. */
export function DayPlanner({
  mode,
  date,
  today,
  nowMin,
  onOpenDay,
}: {
  mode: 'day' | 'week'
  date: string
  today: string
  nowMin: number
  onOpenDay: (date: string) => void
}) {
  const dates = useMemo(() => (mode === 'day' ? [date] : weekDates(date)), [mode, date])
  const range = useDayRange(dates)
  const { saveBlock, removeBlocks, copyDays } = useDayBlockMutations()
  const blocks = range.data ?? []

  const [editor, setEditor] = useState<Editor | null>(null)
  const [copying, setCopying] = useState(false)
  const [notice, setNotice] = useState<{ text: string; undoIds?: string[] } | null>(null)
  const [error, setError] = useState('')

  const editing = editor?.kind === 'edit' ? blocks.find(b => b.id === editor.id) ?? null : null
  const sourceBlocks = blocks.filter(b => b.status !== 'skipped')

  async function place(block: DayBlock, target: string, startMin: number, endMin: number) {
    setError('')
    try {
      await saveBlock.mutateAsync({ ...placeBlock(block, target, startMin, endMin), id: block.id, expectedUpdatedAt: block.updated_at })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move that plan.')
    }
  }

  async function copy(targets: string[] | number) {
    setError('')
    try {
      const copies =
        typeof targets === 'number'
          ? dates.map(day => ({
              from: blocks.filter(b => b.plan_date === day),
              to: Array.from({ length: targets }, (_, week) => addDays(day, 7 * (week + 1))),
            }))
          : [{ from: blocks.filter(b => b.plan_date === date), to: targets }]
      const ids = await copyDays.mutateAsync(copies)
      const where = typeof targets === 'number' ? `the next ${targets === 1 ? 'week' : `${targets} weeks`}` : `${targets.length} ${targets.length === 1 ? 'day' : 'days'}`
      setNotice({ text: `Copied ${ids.length} ${ids.length === 1 ? 'plan' : 'plans'} to ${where}.`, undoIds: ids })
      setCopying(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not copy those plans.')
    }
  }

  async function undo(ids: string[]) {
    setError('')
    try {
      await removeBlocks.mutateAsync(ids)
      setNotice({ text: 'Copy undone.' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not undo the copy.')
    }
  }

  if (range.isError) {
    return (
      <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5">
        <p>Your plans could not be loaded. Nothing has been changed.</p>
        <button className={`${pillButton} mt-3`} onClick={() => range.refetch()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">
          {mode === 'day' ? 'Shape this day.' : 'Shape the week.'} Plans are intentions; you can always change them.
        </p>
        <button className={pillButton} disabled={!sourceBlocks.length} onClick={() => setCopying(true)}>
          <Copy size={14} className="inline mr-1" />
          {mode === 'day' ? 'Copy this day…' : 'Copy this week…'}
        </button>
      </div>

      {notice && (
        <p role="status" className="text-sm text-emerald-800">
          {notice.text}{' '}
          {notice.undoIds?.length ? (
            <button className="underline" disabled={removeBlocks.isPending} onClick={() => undo(notice.undoIds!)}>
              Undo
            </button>
          ) : null}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {!range.data ? (
        <p role="status">Opening your plans…</p>
      ) : (
        <PlanGrid
          key={dates.join()}
          dates={dates}
          blocks={blocks}
          today={today}
          nowMin={nowMin}
          onCreate={(day, startMin, endMin) => {
            setNotice(null)
            setEditor({ kind: 'new', date: day, start: atMinutes(day, startMin), end: atMinutes(day, endMin) })
          }}
          onPlace={(block, day, startMin, endMin) => void place(block, day, startMin, endMin)}
          onOpen={block => {
            setNotice(null)
            setEditor({ kind: 'edit', id: block.id })
          }}
          onOpenDay={onOpenDay}
        />
      )}

      {editor?.kind === 'new' && (
        <NewPlanDialog
          when={`${new Date(`${editor.date}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}, ${timeLabel(editor.start)}–${timeLabel(editor.end)}`}
          onClose={() => setEditor(null)}
          onCreate={async scene => {
            await saveBlock.mutateAsync({
              ...planFromScene(scene, editor.date, { start: editor.start, end: editor.end }),
              position: nextPosition(blocks.filter(b => b.plan_date === editor.date)),
            })
            setEditor(null)
          }}
        />
      )}

      {editing && (
        <Modal label="Plan details" onClose={() => setEditor(null)}>
          <BlockEditor
            key={editing.id}
            block={editing}
            pending={saveBlock.isPending || removeBlocks.isPending}
            onClose={() => setEditor(null)}
            onSave={async input => {
              await saveBlock.mutateAsync({ ...input, id: editing.id, expectedUpdatedAt: editing.updated_at })
              setEditor(null)
            }}
            onRemove={async () => {
              await removeBlocks.mutateAsync([editing.id])
              setEditor(null)
            }}
          />
        </Modal>
      )}

      {copying && (
        <Modal label="Copy plans" onClose={() => setCopying(false)}>
          <CopyDaysPanel
            mode={mode}
            source={mode === 'day' ? date : dates[0]}
            planCount={mode === 'day' ? sourceBlocks.filter(b => b.plan_date === date).length : sourceBlocks.length}
            pending={copyDays.isPending}
            onCopy={targets => void copy(targets)}
            onClose={() => setCopying(false)}
          />
        </Modal>
      )}
    </div>
  )
}
