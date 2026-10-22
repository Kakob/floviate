'use client'

import { useState } from 'react'
import { LivingScene } from './living-scene'
import { RHYTHM_ACTIVITIES, findLive, type RhythmActivityKey, type RhythmEntry, type RhythmKind } from '@/lib/rhythm'

export interface Tap {
  activity: RhythmActivityKey
  kind: RhythmKind
  variant: string | null
}

const subButton =
  'flex w-full items-baseline justify-between border-t border-stone-200 px-3 py-1.5 text-left text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-60'

const LiveDot = () => <span aria-label="running" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />

/**
 * One card per activity: the main tap, then its sub-options (Journal, Vibecode, Gym…) and,
 * for smoking, the urge. Each shows today's count, and a green dot while it is running.
 */
export function TapBar({ dayEntries, live, pending, onTap }: {
  /** Entries on the day being shown, for the counts. */
  dayEntries: RhythmEntry[]
  live: RhythmEntry[]
  pending: boolean
  onTap: (tap: Tap) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const count = (activity: string, kind: RhythmKind, variant: string | null) =>
    dayEntries.filter(e => e.activity === activity && e.kind === kind && e.variant === variant).length
  const isLive = (tap: Tap) => findLive(live, tap.activity, tap.kind, tap.variant) !== null

  return (
    <section aria-label="Log something">
      <p className="text-sm text-stone-500">Tap when it happens. Tap something already running to add a note to it.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RHYTHM_ACTIVITIES.map(activity => {
          const main: Tap = { activity: activity.key, kind: 'did', variant: null }
          const did = count(activity.key, 'did', null)
          return (
            <div
              key={activity.key}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white"
              onPointerEnter={() => setHovered(activity.key)}
              onPointerLeave={() => setHovered(null)}
            >
              <button
                type="button"
                disabled={pending}
                aria-label={`${activity.urges ? 'Smoked' : activity.label}: ${isLive(main) ? 'running, add a note' : 'log one'}. ${did} so far.`}
                onClick={() => onTap(main)}
                onFocus={() => setHovered(activity.key)}
                onBlur={() => setHovered(null)}
                className="block w-full text-left transition hover:bg-stone-50 disabled:opacity-60"
              >
                <LivingScene preset={activity.scene} paused={hovered !== activity.key} />
                <span className="flex items-baseline justify-between px-3 py-2">
                  <span className="text-sm">
                    {isLive(main) && <LiveDot />}
                    {activity.label}
                  </span>
                  <span className="text-xl font-serif tabular-nums">{did}</span>
                </span>
              </button>
              {activity.variants.map(variant => {
                const tap: Tap = { activity: activity.key, kind: 'did', variant: variant.key }
                return (
                  <button
                    key={variant.key}
                    type="button"
                    disabled={pending}
                    aria-label={`${variant.label}: ${isLive(tap) ? 'running, add a note' : 'log one'}`}
                    onClick={() => onTap(tap)}
                    className={subButton}
                  >
                    <span>
                      {isLive(tap) && <LiveDot />}
                      {variant.label}
                    </span>
                    <span className="text-base font-serif tabular-nums">{count(activity.key, 'did', variant.key)}</span>
                  </button>
                )
              })}
              {activity.urges && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onTap({ activity: activity.key, kind: 'urge', variant: null })}
                  className={subButton}
                >
                  <span>
                    {isLive({ activity: activity.key, kind: 'urge', variant: null }) && <LiveDot />}
                    Urge, let it pass
                  </span>
                  <span className="text-base font-serif tabular-nums">{count(activity.key, 'urge', null)}</span>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
