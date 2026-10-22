'use client'

import type { DayBlock, DayCheckIn } from '@/lib/day-scenes'
import { EVENT_LABELS, blockTimeLabel, formatTime } from './format'

function PlanSummary({ plan, prefix }: { plan: DayBlock; prefix?: string }) {
  return (
    <p className="mt-1 whitespace-pre-wrap">
      {prefix}
      {plan.title} · {blockTimeLabel(plan)} · {plan.status}
      {plan.intention && (
        <>
          <br />
          {plan.intention}
        </>
      )}
    </p>
  )
}

/** What was observed/logged, kept visibly separate from the plan itself. */
export function CheckInList({
  title,
  logs,
  isLoading,
  isError,
  onRetry,
}: {
  title: string
  logs: DayCheckIn[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-[#f5f3ed] p-5">
      <h2 className="text-xl font-serif">What you recorded</h2>
      <p className="text-sm text-stone-500 mt-1">{title}</p>
      {isLoading ? (
        <p role="status" className="mt-4 text-sm">Loading check-ins…</p>
      ) : isError ? (
        <div role="alert" className="mt-4 text-sm">
          Check-ins couldn’t be loaded.{' '}
          <button className="underline" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !logs.length ? (
        <p className="mt-5 text-sm text-stone-500">Nothing recorded here yet. A plan alone doesn’t mean it happened.</p>
      ) : (
        <ol className="mt-4 space-y-4 max-h-96 overflow-y-auto">
          {logs.map(log => (
            <li key={log.id} className="border-l-2 border-stone-300 pl-3">
              <p className="text-xs text-stone-500">
                <time dateTime={log.created_at}>{formatTime(log.created_at)}</time> · {EVENT_LABELS[log.event_kind]}
              </p>
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">{log.value_text}</p>
              {log.plan_snapshot && (
                <details className="text-xs text-stone-500 mt-2">
                  <summary className="cursor-pointer">Plan at this moment</summary>
                  <PlanSummary plan={log.plan_snapshot} />
                  {log.previous_plan && <PlanSummary plan={log.previous_plan} prefix="Previously: " />}
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
