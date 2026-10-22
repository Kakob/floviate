'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Sun } from 'lucide-react'
import { SceneHero } from '@/components/day/scene-hero'
import { DayStrip } from '@/components/day/day-strip'
import { BlockEditor } from '@/components/day/block-editor'
import { CheckInPanel, type CheckInContext } from '@/components/day/check-in-panel'
import { CheckInList } from '@/components/day/check-in-list'
import { SupportRow } from '@/components/day/support-row'
import { DayPlanner } from '@/components/day/day-planner'
import { RhythmNow } from '@/components/day/rhythm-now'
import { RhythmHistory } from '@/components/day/rhythm-history'
import { Modal } from '@/components/day/modal'
import { NewPlanDialog } from '@/components/day/new-plan-dialog'
import { planFromScene } from '@/components/day/scene-picker'
import { pillButton } from '@/components/day/format'
import { useDayScenes } from '@/lib/hooks/use-day-scenes'
import { useRhythm } from '@/lib/hooks/use-rhythm'
import { entryLabel, entryScene } from '@/lib/rhythm'
import { silentAdapter } from '@/lib/scene-support'
import { addDays, atMinutes, weekDates } from '@/lib/day-planner'
import { floorMinutes } from '@/lib/time-grid'
import { localDate, nextPosition, type CheckInKind, type DayBlockStatus, type SceneSelection } from '@/lib/day-scenes'

type EditorState = { mode: 'new'; forNow: boolean } | { mode: 'edit'; id: string } | null
type View = 'now' | 'day' | 'week' | 'trends'

const VIEWS: { view: View; label: string }[] = [
  { view: 'now', label: 'Now' },
  { view: 'day', label: 'Day' },
  { view: 'week', label: 'Week' },
  { view: 'trends', label: 'Trends' },
]

export default function TodayPage() {
  const [now, setNow] = useState(() => Date.now())
  const [chosenDate, setChosenDate] = useState<string | null>(null)
  const date = chosenDate ?? localDate(new Date(now))
  const isToday = date === localDate(new Date(now))
  const today = localDate(new Date(now))
  const [view, setView] = useState<View>('now')
  const [selection, setSelection] = useState<SceneSelection>({ kind: 'current' })
  const { blocks, dayBlocks, logs, current, visible, saveBlock, removeBlocks, setStatus, move, checkIn } = useDayScenes(date, selection, now)
  const rhythm = useRhythm(date)
  // What you said you're doing takes the stage, unless you picked a plan to look at.
  const latest = isToday && selection.kind === 'current' ? rhythm.live[0] : undefined
  const doing = latest
    ? { label: entryLabel(latest), scene: entryScene(latest), since: latest.occurred_at, others: rhythm.live.length - 1 }
    : null

  const [editor, setEditor] = useState<EditorState>(null)
  const [kind, setKind] = useState<CheckInKind>('thought')
  const [focusRequest, setFocusRequest] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)

  // The scene follows the clock. Refresh on an interval and whenever the window regains focus.
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 15000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [])

  const context: CheckInContext = { id: visible?.id ?? null, title: visible?.title ?? 'Unplanned time' }
  const editingBlock = editor?.mode === 'edit' ? dayBlocks.find(b => b.id === editor.id) ?? null : null

  function askToCheckIn(next: CheckInKind) {
    setKind(next)
    setNotice('')
    setFocusRequest(n => n + 1)
  }

  async function record(eventKind: CheckInKind, text: string, association: CheckInContext) {
    setError('')
    setNotice('')
    try {
      await checkIn.mutateAsync({ day_block_id: association.id, event_kind: eventKind, value_text: text.trim() })
      setNotice(`Saved to ${association.title}.`)
      if (eventKind !== 'started') setKind('thought')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Your thought is still here; please try again.')
      return false
    }
  }

  async function changeStatus(status: DayBlockStatus) {
    if (!visible) return
    setError('')
    setNotice('')
    try {
      await setStatus.mutateAsync({ id: visible.id, status })
      setSelection({ kind: 'block', id: visible.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the plan.')
    }
  }

  const step = view === 'week' ? 7 : 1
  const week = weekDates(date)
  const heading =
    view === 'week'
      ? `${new Date(`${week[0]}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(`${week[6]}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
      : isToday
        ? view === 'trends' ? 'Your rhythm today.' : 'Today, gently.'
        : new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  // Under the heading: today's full date, or that the browsed week contains today.
  const subheading =
    view === 'week'
      ? week.includes(today) ? 'This week' : null
      : isToday
        ? new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : null

  // "For now": from the current quarter hour, for an hour.
  function nowPlan() {
    const d = new Date(now)
    const startMin = floorMinutes(d.getHours() * 60 + d.getMinutes())
    const start = atMinutes(today, startMin)
    const end = atMinutes(today, startMin + 60)
    return { start, end, endLabel: new Date(end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
  }

  function changeDate(next: string | null) {
    setChosenDate(next)
    setSelection({ kind: 'current' })
    setEditor(null)
    setNotice('')
  }

  return (
    <div className="mx-auto max-w-5xl text-stone-800 space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[.2em] uppercase text-stone-500">A little room for your day</p>
          <h1 className="mt-1 text-3xl font-serif">{heading}</h1>
          {subheading && <p className="mt-1 text-sm text-emerald-800">{subheading}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="View" className="flex rounded-full border border-stone-300 bg-white p-0.5 text-sm">
            {VIEWS.map(option => (
              <button
                key={option.view}
                role="tab"
                aria-selected={view === option.view}
                onClick={() => setView(option.view)}
                className={`rounded-full px-3 py-1.5 ${view === option.view ? 'bg-stone-800 text-white' : 'hover:bg-stone-100'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button aria-label={view === 'week' ? 'Previous week' : 'Previous day'} className={pillButton} onClick={() => changeDate(addDays(date, -step))}>
            <ChevronLeft size={14} />
          </button>
          <label className="sr-only" htmlFor="day-date">
            Browse day
          </label>
          {/* On today the field turns green and says so; any other day looks plain. */}
          <div
            className={`flex items-center rounded-full border text-sm ${
              isToday ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-700/20' : 'border-stone-300 bg-white'
            }`}
          >
            {isToday && (
              <span className="flex items-center gap-1 pl-3 font-medium">
                <Sun size={13} aria-hidden />
                Today
              </span>
            )}
            <input
              id="day-date"
              type="date"
              value={date}
              aria-describedby={isToday ? 'day-date-today' : undefined}
              onChange={e => e.target.value && changeDate(e.target.value)}
              className="rounded-full bg-transparent px-3 py-2"
            />
            {isToday && <span id="day-date-today" className="sr-only">This is today.</span>}
          </div>
          <button aria-label={view === 'week' ? 'Next week' : 'Next day'} className={pillButton} onClick={() => changeDate(addDays(date, step))}>
            <ChevronRight size={14} />
          </button>
          <button className={pillButton} aria-label={isToday ? 'Back to now' : 'Go to today'} onClick={() => changeDate(null)}>
            <Sun size={14} className="inline mr-1" />
            Now
          </button>
        </div>
      </div>

      {view === 'trends' ? (
        <RhythmHistory rhythm={rhythm} date={date} now={now} />
      ) : view !== 'now' ? (
        <DayPlanner
          mode={view}
          date={date}
          today={today}
          nowMin={new Date(now).getHours() * 60 + new Date(now).getMinutes()}
          onOpenDay={day => {
            changeDate(day === today ? null : day)
            setView('day')
          }}
        />
      ) : blocks.isLoading ? (
        <p role="status">Opening your day…</p>
      ) : blocks.isError ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p>Your day could not be loaded. Your saved plans haven’t been changed.</p>
          <p className="text-sm mt-2">{blocks.error.message}</p>
          <button className={`${pillButton} mt-3`} onClick={() => blocks.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <SceneHero
            doing={doing}
            block={visible}
            currentId={isToday ? current?.id ?? null : null}
            now={now}
            paused={paused}
            pending={checkIn.isPending || setStatus.isPending}
            onTogglePause={() => setPaused(p => !p)}
            onCheckIn={() => askToCheckIn('thought')}
            onSomethingElse={() => askToCheckIn('changed_activity')}
            onStarted={() => visible && void record('started', `I started: ${visible.title}`, context)}
            onEdit={() => visible && setEditor({ mode: 'edit', id: visible.id })}
            onChooseForNow={isToday ? () => setEditor({ mode: 'new', forNow: true }) : undefined}
            onStatus={status => void changeStatus(status)}
          />

          <RhythmNow
            rhythm={rhythm}
            date={date}
            isToday={isToday}
            now={now}
            blocks={dayBlocks}
            onOpenBlock={block => setEditor({ mode: 'edit', id: block.id })}
          />

          <DayStrip
            blocks={dayBlocks}
            visibleId={visible?.id ?? null}
            currentId={isToday ? current?.id ?? null : null}
            selection={selection}
            now={now}
            movePending={move.isPending}
            onSelect={next => {
              setSelection(next)
              setNotice('')
            }}
            onMove={(id, direction) => move.mutate({ id, direction })}
            onAdd={() => setEditor({ mode: 'new', forNow: false })}
          />

          {editor?.mode === 'new' && (
            <NewPlanDialog
              when={editor.forNow ? `For now, until ${nowPlan().endLabel}` : `Next in ${isToday ? 'today’s' : 'this day’s'} order`}
              onClose={() => setEditor(null)}
              onCreate={async scene => {
                const times = editor.forNow ? nowPlan() : undefined
                const saved = await saveBlock.mutateAsync({
                  ...planFromScene(scene, date, times),
                  position: nextPosition(dayBlocks),
                })
                setNotice('')
                setSelection({ kind: 'block', id: saved.id })
                setEditor(null)
              }}
            />
          )}

          {editingBlock && (
            <Modal label="Plan details" onClose={() => setEditor(null)}>
              <BlockEditor
                key={editingBlock.id}
                block={editingBlock}
                pending={saveBlock.isPending || removeBlocks.isPending}
                onClose={() => setEditor(null)}
                onSave={async input => {
                  const saved = await saveBlock.mutateAsync({ ...input, id: editingBlock.id, expectedUpdatedAt: editingBlock.updated_at })
                  setNotice('')
                  if (saved.plan_date !== date) setChosenDate(saved.plan_date)
                  setSelection({ kind: 'block', id: saved.id })
                  setEditor(null)
                }}
                onRemove={async () => {
                  await removeBlocks.mutateAsync([editingBlock.id])
                  setSelection({ kind: 'current' })
                  setEditor(null)
                }}
              />
            </Modal>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <CheckInPanel
              context={context}
              kind={kind}
              focusRequest={focusRequest}
              pending={checkIn.isPending}
              notice={notice}
              error={error}
              onKindChange={next => {
                setKind(next)
                setNotice('')
              }}
              onSubmit={record}
            />
            <CheckInList
              title={visible?.title ?? 'Unplanned thoughts on this day'}
              logs={logs.data ?? []}
              isLoading={logs.isLoading}
              isError={logs.isError}
              onRetry={() => logs.refetch()}
            />
          </div>

          <SupportRow adapter={silentAdapter} />
        </>
      )}
    </div>
  )
}
