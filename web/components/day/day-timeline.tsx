'use client'

import { useEffect, useMemo, useRef } from 'react'
import { localDate, type DayBlock } from '@/lib/day-scenes'
import { blockSpan } from '@/lib/day-planner'
import { layoutLanes } from '@/lib/time-grid'
import { entryLabel, entryScene, formatDuration, durationMs, timelineFor, type RhythmEntry } from '@/lib/rhythm'
import { GROUP_STYLES } from './plan-grid'
import { formatTime } from './format'
import { SCENE_PRESETS } from './scenes'

const HOUR_HEIGHT = 44
const PX_PER_MIN = HOUR_HEIGHT / 60
/** Moments are drawn as short markers; this is how much room each claims when laying out lanes. */
const POINT_MIN = 18

const groupStyle = (scene: string) => GROUP_STYLES[(SCENE_PRESETS[scene as keyof typeof SCENE_PRESETS] ?? SCENE_PRESETS.quiet).group]

function hourLabel(h: number) {
  if (h === 0) return ''
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

/**
 * The day on one clock: what you planned on the left, what you logged on the right.
 * Sessions are bars (a live one grows to now), moments are dots, notes are ticks on their session.
 */
export function DayTimeline({ date, isToday, now, blocks, entries, onOpenBlock, onOpenEntry }: {
  date: string
  isToday: boolean
  now: number
  blocks: DayBlock[]
  entries: RhythmEntry[]
  onOpenBlock: (block: DayBlock) => void
  onOpenEntry: (entry: RhythmEntry) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes()

  const planned = useMemo(() => {
    const timed = blocks.flatMap(block => {
      const span = blockSpan(block)
      return span ? [{ block, ...span }] : []
    })
    return { laid: layoutLanes(timed), anyTime: blocks.filter(b => !blockSpan(b) && b.status !== 'skipped') }
  }, [blocks])

  const lived = useMemo(
    () =>
      layoutLanes(
        timelineFor(entries, date, now).map(item => ({
          ...item,
          drawnEnd: item.endMin,
          endMin: Math.max(item.endMin, item.startMin + POINT_MIN),
        }))
      ),
    [entries, date, now]
  )

  // Open an hour before now on today, otherwise at the first thing on the day (or 7 AM).
  useEffect(() => {
    if (!scrollRef.current) return
    const first = Math.min(7 * 60, ...lived.map(l => l.startMin - 30), ...planned.laid.map(l => l.startMin - 30))
    scrollRef.current.scrollTop = Math.max(isToday ? nowMin - 60 : first, 0) * PX_PER_MIN
    // Once per day shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  return (
    <section aria-label="Your day" className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="grid grid-cols-[52px_1fr_1fr] border-b border-stone-200 text-xs uppercase tracking-[.15em] text-stone-500">
        <span />
        <span className="px-2 py-2">Planned</span>
        <span className="border-l border-stone-200 px-2 py-2">Lived</span>
      </div>
      {planned.anyTime.length > 0 && (
        <div className="grid grid-cols-[52px_1fr_1fr] border-b border-stone-100 text-xs">
          <span className="px-1 py-1.5 text-right text-stone-400">any time</span>
          <div className="flex flex-wrap gap-1 px-2 py-1.5">
            {planned.anyTime.map(block => (
              <button key={block.id} onClick={() => onOpenBlock(block)} className={`rounded border-l-[3px] px-1.5 py-0.5 ${groupStyle(block.scene)} ${block.status === 'done' ? 'opacity-60' : ''}`}>
                {block.title}
              </button>
            ))}
          </div>
          <span className="border-l border-stone-200" />
        </div>
      )}
      <div ref={scrollRef} className="max-h-[480px] overflow-y-auto">
        <div className="relative grid grid-cols-[52px_1fr_1fr]" style={{ height: 24 * HOUR_HEIGHT }}>
          <div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative text-right text-[11px] text-stone-400" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-2">{hourLabel(h)}</span>
              </div>
            ))}
          </div>

          <div className="relative border-l border-stone-100">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="border-b border-stone-100" style={{ height: HOUR_HEIGHT }} />
            ))}
            {planned.laid.map(({ block, startMin, endMin, lane, totalLanes }) => {
              const width = 100 / totalLanes
              return (
                <button
                  key={block.id}
                  onClick={() => onOpenBlock(block)}
                  style={{ top: startMin * PX_PER_MIN, height: Math.max((endMin - startMin) * PX_PER_MIN, 16), left: `calc(${lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                  className={`absolute overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight hover:brightness-95 ${groupStyle(block.scene)} ${
                    block.status === 'skipped' ? 'opacity-50 line-through' : block.status === 'done' ? 'opacity-60' : 'opacity-80'
                  }`}
                >
                  <span className="block truncate font-medium">{block.title}</span>
                </button>
              )
            })}
          </div>

          <div className="relative border-l border-stone-200">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="border-b border-stone-100" style={{ height: HOUR_HEIGHT }} />
            ))}
            {lived.map(({ entry, startMin, drawnEnd, shape, lane, totalLanes }) => {
              const width = 100 / totalLanes
              const left = `calc(${lane * width}% + 2px)`
              const label = entryLabel(entry)
              if (shape === 'point') {
                return (
                  <button
                    key={entry.id}
                    onClick={() => onOpenEntry(entry)}
                    title={`${label} at ${formatTime(entry.occurred_at)}`}
                    style={{ top: startMin * PX_PER_MIN - 7, left, width: `calc(${width}% - 4px)` }}
                    className="absolute z-10 flex items-center gap-1 truncate text-left text-[11px] text-stone-700 hover:underline"
                  >
                    <span className={`h-3 w-3 shrink-0 rounded-full border-2 border-white shadow ${entry.kind === 'urge' ? 'bg-amber-500' : 'bg-stone-700'}`} />
                    <span className="truncate">{label}</span>
                  </button>
                )
              }
              const live = entry.ended_at === null
              const height = Math.max((drawnEnd - startMin) * PX_PER_MIN, 16)
              return (
                <button
                  key={entry.id}
                  onClick={() => onOpenEntry(entry)}
                  style={{ top: startMin * PX_PER_MIN, height, left, width: `calc(${width}% - 4px)` }}
                  className={`absolute overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight hover:brightness-95 ${
                    entry.kind === 'urge' ? 'border-amber-500 bg-amber-50 text-amber-900' : groupStyle(entryScene(entry))
                  } ${live ? 'ring-2 ring-emerald-600/40' : ''}`}
                >
                  <span className="block truncate font-medium">{label}</span>
                  {height >= 30 && <span className="block truncate opacity-70">{live ? 'running · ' : ''}{formatDuration(durationMs(entry, now))}</span>}
                  {(entry.marks ?? []).map(mark => {
                    const d = new Date(mark.at)
                    if (localDate(d) !== date) return null
                    const at = d.getHours() * 60 + d.getMinutes() - startMin
                    return (
                      <span
                        key={mark.id}
                        aria-hidden
                        className="absolute right-0 h-0.5 w-2 bg-current opacity-60"
                        style={{ top: Math.min(Math.max(at * PX_PER_MIN, 0), height - 2) }}
                      />
                    )
                  })}
                </button>
              )
            })}
          </div>

          {isToday && (
            <div className="pointer-events-none absolute left-[52px] right-0 z-20 h-0.5 bg-emerald-700" style={{ top: nowMin * PX_PER_MIN }}>
              <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-700" />
            </div>
          )}
        </div>
      </div>
      <p className="border-t border-stone-100 px-4 py-2 text-xs text-stone-500">Bars are sessions, dots are single taps, ticks are notes. Tap any of them to see or change it.</p>
    </section>
  )
}
