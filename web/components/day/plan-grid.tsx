'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DayBlock } from '@/lib/day-scenes'
import { blockSpan } from '@/lib/day-planner'
import { MINUTES_PER_DAY, clamp, floorMinutes, layoutLanes, snapMinutes } from '@/lib/time-grid'
import { SCENE_PRESETS, type SceneGroup } from './scenes'

const HOUR_HEIGHT = 48
const PX_PER_MIN = HOUR_HEIGHT / 60
const LABEL_WIDTH = 52
const MIN_DURATION = 15
const DEFAULT_DURATION = 60
const DRAG_THRESHOLD_PX = 4

export const GROUP_STYLES: Record<SceneGroup, string> = {
  'Work & study': 'bg-[#e3ead9] border-[#829082] text-[#3d4a3d]',
  Movement: 'bg-[#dbe8e6] border-[#6d8b88] text-[#35504d]',
  Everyday: 'bg-[#f1e3d3] border-[#b98d73] text-[#5c4332]',
  'Out & about': 'bg-[#e4e3dc] border-[#8d8f84] text-[#45473f]',
}

type Drag =
  | { kind: 'move'; block: DayBlock; grabOffsetMin: number; duration: number; x: number; y: number; moved: boolean }
  | { kind: 'resize'; block: DayBlock; startMin: number; dayIdx: number }
  | { kind: 'create'; originMin: number; dayIdx: number; moved: boolean }
  | { kind: 'place'; block: DayBlock; x: number; y: number; moved: boolean }

interface Preview {
  blockId: string | null
  dayIdx: number
  startMin: number
  duration: number
}

const blockStyle = (block: DayBlock) =>
  `${GROUP_STYLES[(SCENE_PRESETS[block.scene] ?? SCENE_PRESETS.quiet).group]} ${
    block.status === 'skipped' ? 'opacity-50 line-through' : block.status === 'done' ? 'opacity-60' : ''
  }`

function formatMin(m: number) {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  const suffix = h < 12 ? 'a' : 'p'
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${suffix}`
}

function formatHour(h: number) {
  if (h === 0) return ''
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

/**
 * A 24-hour planning grid for one or more days. Drag empty space to make a plan, drag a plan to move it
 * (across days too), drag its bottom edge to resize, or drag an "any time" plan onto the grid to give it a time.
 */
export function PlanGrid({
  dates,
  blocks,
  today,
  nowMin,
  onCreate,
  onPlace,
  onOpen,
  onOpenDay,
}: {
  dates: string[]
  blocks: DayBlock[]
  today: string
  nowMin: number
  onCreate: (date: string, startMin: number, endMin: number) => void
  onPlace: (block: DayBlock, date: string, startMin: number, endMin: number) => void
  onOpen: (block: DayBlock) => void
  onOpenDay?: (date: string) => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const previewRef = useRef<Preview | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const [preview, setPreviewState] = useState<Preview | null>(null)

  const setDrag = (next: Drag | null) => {
    dragRef.current = next
    setDragState(next)
  }
  const setPreview = (next: Preview | null) => {
    previewRef.current = next
    setPreviewState(next)
  }

  const columns = useMemo(
    () =>
      dates.map(date => {
        const dayBlocks = blocks.filter(b => b.plan_date === date)
        const timed = dayBlocks.flatMap(block => {
          const span = blockSpan(block)
          return span ? [{ block, ...span }] : []
        })
        return { date, anyTime: dayBlocks.filter(b => !blockSpan(b)), laid: layoutLanes(timed) }
      }),
    [dates, blocks]
  )

  // Open an hour before now on today; otherwise at the morning, or earlier if a plan starts earlier.
  useEffect(() => {
    if (!scrollRef.current) return
    const earliest = Math.min(7 * 60, ...columns.flatMap(c => c.laid.map(l => l.startMin - 30)))
    const start = dates.includes(today) ? Math.max(nowMin - 60, 0) : Math.max(earliest, 0)
    scrollRef.current.scrollTop = start * PX_PER_MIN
    // Once per mount; the planner remounts the grid for each new range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pointerToGrid = (clientX: number, clientY: number) => {
    const rect = gridRef.current!.getBoundingClientRect()
    const colWidth = (rect.width - LABEL_WIDTH) / dates.length
    const inside = clientX >= rect.left + LABEL_WIDTH && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    return {
      inside,
      dayIdx: clamp(Math.floor((clientX - rect.left - LABEL_WIDTH) / colWidth), 0, dates.length - 1),
      minute: clamp((clientY - rect.top) / PX_PER_MIN, 0, MINUTES_PER_DAY),
    }
  }

  useEffect(() => {
    if (!drag) return

    const onMove = (e: PointerEvent) => {
      const current = dragRef.current
      if (!current || !gridRef.current) return
      const { dayIdx, minute, inside } = pointerToGrid(e.clientX, e.clientY)

      if (current.kind === 'move' || current.kind === 'place') {
        const moved = current.moved || Math.hypot(e.clientX - current.x, e.clientY - current.y) > DRAG_THRESHOLD_PX
        if (moved !== current.moved) dragRef.current = { ...current, moved }
        if (!moved) return
        if (current.kind === 'place' && !inside) return setPreview(null)
        const duration = current.kind === 'move' ? current.duration : DEFAULT_DURATION
        const offset = current.kind === 'move' ? current.grabOffsetMin : DEFAULT_DURATION / 2
        const startMin = clamp(snapMinutes(minute - offset), 0, MINUTES_PER_DAY - duration)
        setPreview({ blockId: current.block.id, dayIdx, startMin, duration })
      } else if (current.kind === 'resize') {
        const duration = clamp(snapMinutes(minute) - current.startMin, MIN_DURATION, MINUTES_PER_DAY - current.startMin)
        setPreview({ blockId: current.block.id, dayIdx: current.dayIdx, startMin: current.startMin, duration })
      } else {
        const slot = clamp(floorMinutes(minute), 0, MINUTES_PER_DAY - MIN_DURATION)
        if (slot !== current.originMin && !current.moved) dragRef.current = { ...current, moved: true }
        const lo = Math.min(current.originMin, slot)
        const hi = Math.max(current.originMin, slot)
        setPreview({ blockId: null, dayIdx: current.dayIdx, startMin: lo, duration: hi - lo + MIN_DURATION })
      }
    }

    const onUp = () => {
      const current = dragRef.current
      const final = previewRef.current
      setDrag(null)
      setPreview(null)
      if (!current) return
      if (current.kind === 'move' || current.kind === 'place') {
        if (!current.moved) return onOpen(current.block)
        if (final) onPlace(current.block, dates[final.dayIdx], final.startMin, final.startMin + final.duration)
      } else if (current.kind === 'resize') {
        if (final) onPlace(current.block, dates[current.dayIdx], final.startMin, final.startMin + final.duration)
      } else {
        const startMin = current.moved && final ? final.startMin : current.originMin
        const duration = current.moved && final ? final.duration : DEFAULT_DURATION
        onCreate(dates[current.dayIdx], startMin, Math.min(startMin + duration, MINUTES_PER_DAY))
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // Handlers read the latest drag through refs; resubscribe only when a drag starts or ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  const startCreate = (e: React.PointerEvent, dayIdx: number) => {
    if (e.button !== 0) return
    const { minute } = pointerToGrid(e.clientX, e.clientY)
    const originMin = clamp(floorMinutes(minute), 0, MINUTES_PER_DAY - MIN_DURATION)
    // On touch, a tap creates a block; dragging stays free to scroll the grid.
    if (e.pointerType === 'touch') return
    e.preventDefault()
    setDrag({ kind: 'create', originMin, dayIdx, moved: false })
    setPreview({ blockId: null, dayIdx, startMin: originMin, duration: MIN_DURATION })
  }

  const tapCreate = (e: React.MouseEvent, dayIdx: number) => {
    if ((e.nativeEvent as PointerEvent).pointerType !== 'touch') return
    const { minute } = pointerToGrid(e.clientX, e.clientY)
    const startMin = clamp(floorMinutes(minute), 0, MINUTES_PER_DAY - DEFAULT_DURATION)
    onCreate(dates[dayIdx], startMin, startMin + DEFAULT_DURATION)
  }

  const startMove = (e: React.PointerEvent, block: DayBlock, startMin: number, duration: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const { minute } = pointerToGrid(e.clientX, e.clientY)
    setDrag({ kind: 'move', block, grabOffsetMin: minute - startMin, duration, x: e.clientX, y: e.clientY, moved: false })
  }

  const startResize = (e: React.PointerEvent, block: DayBlock, startMin: number, dayIdx: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setDrag({ kind: 'resize', block, startMin, dayIdx })
  }

  const startPlace = (e: React.PointerEvent, block: DayBlock) => {
    if (e.button !== 0) return
    e.preventDefault()
    setDrag({ kind: 'place', block, x: e.clientX, y: e.clientY, moved: false })
  }

  const multi = dates.length > 1
  const draggingId = drag && drag.kind !== 'create' ? drag.block.id : null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: multi ? LABEL_WIDTH + dates.length * 104 : undefined }}>
          <div className="flex border-b border-stone-200 bg-[#faf8f1]">
            <div style={{ width: LABEL_WIDTH }} className="flex-none px-1 py-2 text-[10px] leading-tight text-stone-400">
              any
              <br />
              time
            </div>
            {columns.map(({ date, anyTime }) => {
              const d = new Date(`${date}T12:00:00`)
              return (
                <div key={date} className="flex-1 min-w-0 border-l border-stone-100 px-1.5 py-2">
                  {multi && (
                    <button
                      onClick={() => onOpenDay?.(date)}
                      className={`mb-1 block w-full rounded text-left text-xs hover:bg-stone-100 ${date === today ? 'font-semibold text-emerald-800' : 'text-stone-500'}`}
                    >
                      {d.toLocaleDateString([], { weekday: 'short' })} {d.getDate()}
                    </button>
                  )}
                  <div className="flex flex-col gap-1 min-h-[24px]">
                    {anyTime.map(block => (
                      <button
                        key={block.id}
                        onPointerDown={e => startPlace(e, block)}
                        style={{ touchAction: 'none' }}
                        className={`truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] cursor-grab ${blockStyle(block)} ${draggingId === block.id ? 'opacity-40' : ''}`}
                        title="Drag onto the grid to give it a time, or click to edit"
                      >
                        {block.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '62vh' }}>
            <div ref={gridRef} className="relative flex select-none" style={{ height: 24 * HOUR_HEIGHT }}>
              <div style={{ width: LABEL_WIDTH }} className="relative flex-none border-r border-stone-200">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute right-1.5 text-[10px] text-stone-400" style={{ top: h * HOUR_HEIGHT - 6 }}>
                    {formatHour(h)}
                  </div>
                ))}
              </div>
              {columns.map(({ date, laid }, dayIdx) => {
                const ghost = preview && preview.dayIdx === dayIdx ? preview : null
                return (
                  <div
                    key={date}
                    onPointerDown={e => startCreate(e, dayIdx)}
                    onClick={e => tapCreate(e, dayIdx)}
                    className={`relative flex-1 min-w-0 border-l border-stone-100 cursor-cell ${date === today ? 'bg-emerald-50/40' : ''}`}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="border-b border-stone-100" style={{ height: HOUR_HEIGHT }} />
                    ))}
                    {laid.map(({ block, startMin, endMin, lane, totalLanes }) => {
                      if (preview?.blockId === block.id) return null
                      const width = 100 / totalLanes
                      const duration = endMin - startMin
                      return (
                        <div
                          key={block.id}
                          onPointerDown={e => startMove(e, block, startMin, duration)}
                          onClick={e => e.stopPropagation()}
                          style={{
                            top: startMin * PX_PER_MIN,
                            height: Math.max(duration * PX_PER_MIN, 16),
                            left: `calc(${lane * width}% + 1px)`,
                            width: `calc(${width}% - 2px)`,
                            touchAction: 'none',
                          }}
                          className={`absolute z-10 overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight cursor-grab hover:brightness-95 ${blockStyle(block)}`}
                        >
                          <div className="truncate font-medium">{block.title}</div>
                          {duration >= 40 && (
                            <div className="truncate opacity-70">
                              {formatMin(startMin)}–{formatMin(endMin)}
                            </div>
                          )}
                          <div
                            onPointerDown={e => startResize(e, block, startMin, dayIdx)}
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                            aria-hidden
                          />
                        </div>
                      )
                    })}
                    {ghost && (
                      <div
                        className="pointer-events-none absolute inset-x-0.5 z-20 rounded border border-dashed border-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 text-[11px] text-emerald-900"
                        style={{ top: ghost.startMin * PX_PER_MIN, height: Math.max(ghost.duration * PX_PER_MIN, 16) }}
                      >
                        {formatMin(ghost.startMin)}–{formatMin(ghost.startMin + ghost.duration)}
                      </div>
                    )}
                    {date === today && (
                      <div className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-emerald-700" style={{ top: nowMin * PX_PER_MIN }}>
                        <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-700" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
        Drag empty space to plan something · drag a plan to move it · drag its bottom edge to resize · drag an “any time” plan onto the grid to give it a time
      </p>
    </div>
  )
}
