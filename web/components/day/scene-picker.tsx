'use client'

import { useState } from 'react'
import type { ScenePreset } from '@/lib/day-scenes'
import { LivingScene } from './living-scene'
import { SCENE_GROUPS, SCENE_PRESETS } from './scenes'

/**
 * Choose a plan by its scene. Thumbnails stay still until hovered or focused, so a grid of
 * eighteen scenes doesn't all move at once.
 */
export function ScenePicker({
  value,
  compact = false,
  disabled = false,
  onPick,
}: {
  value?: ScenePreset
  compact?: boolean
  disabled?: boolean
  onPick: (scene: ScenePreset) => void
}) {
  const [active, setActive] = useState<ScenePreset | null>(null)
  return (
    <div className="space-y-4">
      {SCENE_GROUPS.map(group => (
        <section key={group} aria-label={group}>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-stone-500">{group}</h3>
          <div className={`grid gap-2 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {(Object.keys(SCENE_PRESETS) as ScenePreset[])
              .filter(key => SCENE_PRESETS[key].group === group)
              .map(key => {
                const selected = value === key
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => onPick(key)}
                    onPointerEnter={() => setActive(key)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(key)}
                    onBlur={() => setActive(null)}
                    className={`overflow-hidden rounded-xl border text-left transition disabled:opacity-50 ${
                      selected
                        ? 'border-emerald-800 ring-2 ring-emerald-800/30'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <LivingScene preset={key} paused={active !== key} />
                    <span className={`block truncate px-2 py-1.5 ${compact ? 'text-[11px]' : 'text-xs'} ${selected ? 'bg-emerald-50' : 'bg-white'}`}>
                      {SCENE_PRESETS[key].label}
                    </span>
                  </button>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}

/** A new plan, from a scene alone: named after the scene until the user names it. */
export function planFromScene(scene: ScenePreset, date: string, times?: { start: string; end: string }) {
  return {
    plan_date: date,
    title: SCENE_PRESETS[scene].label,
    intention: '',
    scene,
    item_id: null,
    planned_start: times?.start ?? null,
    planned_end: times?.end ?? null,
  }
}
