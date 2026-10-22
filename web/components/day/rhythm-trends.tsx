'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import {
  MOMENTS,
  RHYTHM_ACTIVITIES,
  TREND_DAYS,
  busiestDay,
  dailyCounts,
  feelingSummary,
  formatDuration,
  trendTone,
  weekOverWeek,
  type DayCount,
  type RhythmActivity,
  type RhythmEntry,
  type RhythmKind,
  type RhythmPeak,
} from '@/lib/rhythm'

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

const peakDate = (date: string) => {
  const d = new Date(`${date}T12:00:00`)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}

/** All-time peaks: loaded, still loading, or unavailable (e.g. the database function isn't deployed yet). */
export type AllTimePeaks = { status: 'ready'; peaks: RhythmPeak[] } | { status: 'loading' } | { status: 'error' }

/** The most in one day, over the chart's four weeks and over all time. */
function MostInADay({ days, activity, kind, allTime }: {
  days: DayCount[]
  activity: string
  kind: RhythmKind
  allTime: AllTimePeaks
}) {
  const recent = busiestDay(days, kind)
  const ever = allTime.status === 'ready' ? allTime.peaks.find(p => p.activity === activity && p.kind === kind) : undefined
  return (
    <p className="text-xs text-stone-600">
      Most in a day: {recent ? <><span className="font-medium">{recent.count}</span> in 4 weeks ({peakDate(recent.date)})</> : 'none in 4 weeks'}
      <span className="text-stone-500">
        {' · '}
        {allTime.status === 'loading'
          ? 'all time…'
          : allTime.status === 'error'
            ? 'all time unavailable'
            : ever
              ? `${ever.peak} all time (${peakDate(ever.peak_date)})`
              : 'none ever'}
      </span>
    </p>
  )
}

const TONE_CLASS = { better: 'text-emerald-800', worse: 'text-amber-800', same: 'text-stone-500' }

function WeekChange({ entries, activity, endDate, kind, goal, noun }: {
  entries: RhythmEntry[]
  activity: string
  endDate: string
  kind: RhythmKind
  goal: 'more' | 'less'
  noun: string
}) {
  const { current, previous, change } = weekOverWeek(entries, activity, endDate, kind)
  const tone = trendTone(change, goal)
  const Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : Minus
  return (
    <p className="text-sm">
      <span className="font-medium">{current}</span> {noun} this week
      <span className="text-stone-500"> · {previous} the week before</span>
      {(current > 0 || previous > 0) && (
        <span className={`ml-2 inline-flex items-center gap-0.5 ${TONE_CLASS[tone]}`}>
          <Icon size={13} aria-hidden />
          {change === 0 ? 'steady' : `${Math.abs(change)} ${change > 0 ? 'more' : 'fewer'}`}
        </span>
      )}
    </p>
  )
}

/** Daily counts as thin bars anchored to the baseline. Smoking stacks resisted urges above what was smoked. */
function Strip({ days, activity }: { days: DayCount[]; activity: RhythmActivity }) {
  const empty = days.every(d => d.did + d.urge === 0)
  const peak = Math.max(1, ...days.map(d => d.did + d.urge))
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover === null ? null : days[hover]
  const describe = (d: (typeof days)[number]) =>
    (activity.urges ? `${d.did} smoked, ${d.urge} urge${d.urge === 1 ? '' : 's'} let pass` : `${d.did} time${d.did === 1 ? '' : 's'}`) +
    (d.minutes ? `, ${formatDuration(d.minutes * 60_000)} in sessions` : '')

  return (
    <div>
      <p className="h-5 text-xs text-stone-500" aria-live="polite">
        {shown ? `${shortDate(shown.date)}: ${describe(shown)}` : empty ? 'Nothing logged in the last 4 weeks' : ''}
      </p>
      <div
        role="img"
        aria-label={`${activity.label}, last ${TREND_DAYS} days: ${days.reduce((n, d) => n + d.did, 0)} times`}
        className="flex h-16 items-end gap-[2px] border-b border-stone-300"
        onPointerLeave={() => setHover(null)}
      >
        {days.map((d, i) => (
          <div
            key={d.date}
            className={`flex h-full flex-1 flex-col-reverse gap-[2px] ${hover === i ? 'bg-stone-100' : ''}`}
            onPointerEnter={() => setHover(i)}
          >
            {d.did > 0 && <div className="rounded-t-[4px] bg-stone-700" style={{ height: `${(d.did / peak) * 100}%` }} />}
            {d.urge > 0 && <div className="rounded-t-[4px] bg-stone-300" style={{ height: `${(d.urge / peak) * 100}%` }} />}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-stone-400">
        <span>{shortDate(days[0].date)}</span>
        <span>{shortDate(days[days.length - 1].date)}</span>
      </div>
      {activity.urges && (
        <p className="mt-1 flex gap-3 text-[11px] text-stone-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-stone-700" />Smoked</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-stone-300" />Urge, let it pass</span>
        </p>
      )}
    </div>
  )
}

/** Time spent in finished sessions: the last 7 days of the strip against the 7 before. Hidden until there is some. */
function TimeSpent({ days }: { days: DayCount[] }) {
  const sum = (slice: DayCount[]) => slice.reduce((n, d) => n + d.minutes, 0)
  const current = sum(days.slice(-7))
  const previous = sum(days.slice(-14, -7))
  if (!sum(days)) return null
  const fmt = (min: number) => (min ? formatDuration(min * 60_000) : 'none')
  return (
    <p className="text-sm">
      <span className="font-medium">{fmt(current)}</span> in sessions this week
      <span className="text-stone-500"> · {fmt(previous)} the week before</span>
    </p>
  )
}

function Feelings({ entries, activity, endDate }: { entries: RhythmEntry[]; activity: string; endDate: string }) {
  const summary = feelingSummary(entries, activity, endDate)
  const rated = MOMENTS.filter(({ value }) => summary[value].count)
  if (!rated.length) return <p className="text-xs text-stone-400">No feelings noted yet.</p>
  const shift = summary.shift.average
  return (
    <p className="text-xs text-stone-600">
      Average feeling: {rated.map(({ value, label }) => `${label.toLowerCase()} ${summary[value].average}`).join(' · ')}
      {shift !== null && (
        <span className="text-stone-500">
          {' · '}
          {shift === 0 ? 'no change' : `${shift > 0 ? '+' : '−'}${Math.abs(shift)}`} from before to after
          {summary.shift.count < 3 && ` (${summary.shift.count} time${summary.shift.count === 1 ? '' : 's'})`}
        </span>
      )}
    </p>
  )
}

export function RhythmTrends({ entries, endDate, allTime }: { entries: RhythmEntry[]; endDate: string; allTime: AllTimePeaks }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="text-xl font-serif">Over the last four weeks</h2>
      <p className="text-sm text-stone-500 mt-1">Each bar is a day. Hover to see it.</p>
      <div className="mt-5 grid gap-x-8 gap-y-7 md:grid-cols-2">
        {RHYTHM_ACTIVITIES.map(activity => {
          const days = dailyCounts(entries, activity.key, endDate)
          return (
          <div key={activity.key} className="space-y-2">
            <h3 className="font-medium">{activity.label}</h3>
            <Strip days={days} activity={activity} />
            <MostInADay days={days} activity={activity.key} kind="did" allTime={allTime} />
            <WeekChange entries={entries} activity={activity.key} endDate={endDate} kind="did" goal={activity.goal} noun={activity.urges ? 'smoked' : 'times'} />
            <TimeSpent days={days} />
            {activity.urges && (
              <WeekChange entries={entries} activity={activity.key} endDate={endDate} kind="urge" goal="more" noun="urges let pass" />
            )}
            <Feelings entries={entries} activity={activity.key} endDate={endDate} />
          </div>
          )
        })}
      </div>
    </section>
  )
}
