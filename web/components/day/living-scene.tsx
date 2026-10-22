'use client'

import { useId } from 'react'
import type { ScenePreset } from '@/lib/day-scenes'
import { SCENE_PRESETS } from './scenes'
import styles from './scene.module.css'

/** Pure atmosphere. No clock, task, progress, journal, or audio dependencies. Unknown keys fall back to the quiet room. */
export function LivingScene({ preset, paused = false }: { preset: ScenePreset; paused?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const config = SCENE_PRESETS[preset] ?? SCENE_PRESETS.quiet
  return (
    <svg
      viewBox="0 0 900 440"
      role="img"
      aria-label={`A softly animated scene: ${config.label.toLowerCase()}`}
      className={`${styles.scene} ${paused ? styles.paused : ''}`}
    >
      {config.render(uid)}
    </svg>
  )
}
