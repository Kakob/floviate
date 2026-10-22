'use client'

import type { DayBlock, DayBlockStatus, ScenePreset } from '@/lib/day-scenes'
import { LivingScene } from './living-scene'
import { blockStatusLabel, blockTimeLabel, formatTime, pillButton } from './format'

/** Something you said you're doing right now, which takes the stage over the plan. */
export interface Doing {
  label: string
  scene: ScenePreset
  since: string
  /** How many other things are running alongside it. */
  others: number
}

/**
 * The glance: what you're doing now if you've said so, otherwise the planned scene for this
 * moment, with its intention and one-tap ways to respond to the plan.
 */
export function SceneHero({
  doing = null,
  block,
  currentId,
  now,
  paused,
  pending,
  onTogglePause,
  onCheckIn,
  onSomethingElse,
  onStarted,
  onEdit,
  onChooseForNow,
  onStatus,
}: {
  doing?: Doing | null
  block: DayBlock | null
  currentId: string | null
  now: number
  paused: boolean
  pending: boolean
  onTogglePause: () => void
  onCheckIn: () => void
  onSomethingElse: () => void
  onStarted: () => void
  onEdit: () => void
  /** When nothing is planned now: pick a scene and it becomes the plan for the next hour. */
  onChooseForNow?: () => void
  onStatus: (status: DayBlockStatus) => void
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-[#faf8f1] shadow-sm" aria-label={doing ? 'What you’re doing' : 'Planned scene'}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-stone-500">
        <span>
          {doing
            ? `You’re doing this now · since ${formatTime(doing.since)}${doing.others ? ` · and ${doing.others} more` : ''}`
            : block
              ? `${block.id === currentId ? 'Planned for now' : blockStatusLabel(block, currentId, now)} · ${blockTimeLabel(block)}`
              : 'Unplanned time · space to choose'}
        </span>
        <button onClick={onTogglePause} className="rounded px-2 py-1 hover:bg-stone-200" aria-pressed={paused}>
          {paused ? 'Resume animation' : 'Pause animation'}
        </button>
      </div>
      <button
        className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
        aria-label="Check in with this scene"
        onClick={onCheckIn}
      >
        <LivingScene preset={doing?.scene ?? block?.scene ?? 'quiet'} paused={paused} />
      </button>
      <div className="p-6 sm:p-8">
        {doing ? (
          <>
            <h2 className="font-serif text-3xl sm:text-4xl">{doing.label}</h2>
            {/* The plan stays in view underneath, so the two can be compared at a glance. */}
            <p className="mt-3 text-xs uppercase tracking-[.2em] text-stone-500">
              {block ? (block.id === currentId ? 'Planned for now' : blockStatusLabel(block, currentId, now)) : 'Nothing planned for now'}
            </p>
            {block && <p className="mt-1 font-serif text-xl text-stone-600">{block.title}</p>}
            {block?.intention && <p className="mt-1 max-w-2xl text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{block.intention}</p>}
          </>
        ) : (
          <>
            <h2 className="font-serif text-3xl sm:text-4xl">{block?.title ?? 'Nothing you need to be.'}</h2>
            <p className="mt-3 max-w-2xl text-stone-600 leading-relaxed whitespace-pre-wrap">
              {block?.intention ||
                (block
                  ? 'This is what you made room for. You can always choose something else.'
                  : 'Leave this moment open, or make a little plan. You can record a thought either way.')}
            </p>
          </>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {!block && !doing && onChooseForNow && (
            <button className="rounded-full bg-emerald-800 px-5 py-2 text-sm text-white hover:bg-emerald-700" onClick={onChooseForNow}>
              Choose a scene for now
            </button>
          )}
          <button className="rounded-full bg-stone-800 px-5 py-2 text-sm text-white hover:bg-stone-700" onClick={onCheckIn}>
            Check in
          </button>
          {block && block.status === 'planned' && (
            <button className={pillButton} disabled={pending} onClick={onStarted}>
              I started
            </button>
          )}
          <button className={pillButton} onClick={onSomethingElse}>
            I’m doing something else
          </button>
          {block && (
            <button className={pillButton} onClick={onEdit}>
              {block.intention ? 'Change the plan' : 'Add details'}
            </button>
          )}
        </div>
        {block && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-stone-500">
            {block.status === 'planned' ? (
              <>
                <button disabled={pending} className="underline" onClick={() => onStatus('done')}>
                  I’m done with this
                </button>
                <button disabled={pending} className="underline" onClick={() => onStatus('skipped')}>
                  Skip this
                </button>
              </>
            ) : (
              <button disabled={pending} className="underline" onClick={() => onStatus('planned')}>
                Put this back in the plan
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
