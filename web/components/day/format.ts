import { isTimed, type DayBlock, type DayEventKind } from '@/lib/day-scenes'

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export const pillButton =
  'rounded-full border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-50'

export const EVENT_LABELS: Record<DayEventKind, string> = {
  thought: 'Thought',
  started: 'Started',
  changed_activity: 'Doing something else',
  plan_changed: 'Plan changed',
  finished: 'Said I was done',
  skipped: 'Skipped',
}

export function blockTimeLabel(block: DayBlock) {
  return isTimed(block) ? `${formatTime(block.planned_start)}–${formatTime(block.planned_end)}` : 'Any time'
}

/** Describes the plan's state without implying anything happened. */
export function blockStatusLabel(block: DayBlock, currentId: string | null, now: number) {
  if (block.status === 'skipped') return 'Skipped'
  if (block.status === 'done') return 'You said you were done'
  if (block.id === currentId) return 'Planned for now'
  if (isTimed(block)) return Date.parse(block.planned_end) <= now ? 'Earlier plan' : 'Later'
  return 'In your order'
}
