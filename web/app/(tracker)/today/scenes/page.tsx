'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LivingScene } from '@/components/day/living-scene'
import { SCENE_GROUPS, SCENE_PRESETS } from '@/components/day/scenes'
import type { ScenePreset } from '@/lib/day-scenes'

/** Every scene, side by side, for choosing one and for reviewing changes to the drawings. */
export default function ScenesGalleryPage() {
  const [paused, setPaused] = useState(false)
  return (
    <div className="mx-auto max-w-6xl text-stone-800 space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/today" className="text-sm text-stone-500 underline underline-offset-4">
            ← Back to today
          </Link>
          <h1 className="mt-2 text-3xl font-serif">Scenes</h1>
          <p className="mt-1 text-sm text-stone-500">Choose one for any plan with “Change the plan”.</p>
        </div>
        <button
          onClick={() => setPaused(p => !p)}
          aria-pressed={paused}
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-100"
        >
          {paused ? 'Resume animations' : 'Pause animations'}
        </button>
      </div>
      {SCENE_GROUPS.map(group => (
        <section key={group} aria-label={group} className="space-y-3">
          <h2 className="text-lg font-serif">{group}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(SCENE_PRESETS) as [ScenePreset, (typeof SCENE_PRESETS)[ScenePreset]][])
              .filter(([, config]) => config.group === group)
              .map(([key, config]) => (
                <figure key={key} className="overflow-hidden rounded-2xl border border-stone-200 bg-[#faf8f1]">
                  <LivingScene preset={key} paused={paused} />
                  <figcaption className="px-4 py-3">
                    <span className="block text-sm">{config.label}</span>
                    <span className="block text-xs text-stone-500">{config.hint}</span>
                  </figcaption>
                </figure>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
