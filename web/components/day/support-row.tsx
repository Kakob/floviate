'use client'

import Link from 'next/link'
import { VolumeX } from 'lucide-react'
import type { SceneSupportAdapter } from '@/lib/scene-support'

/**
 * Where supported mode (music, narration) will live. It only acts on explicit requests
 * through the adapter; check-ins never reach it. Silence is the default.
 */
export function SupportRow({ adapter }: { adapter: SceneSupportAdapter }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-1 text-sm text-stone-500">
      <span>
        <VolumeX size={15} className="inline mr-2" />
        {adapter.available ? 'This scene is quiet.' : 'This scene is quiet. Music and narration aren’t connected yet.'}
      </span>
      <Link href="/focus" className="underline underline-offset-4">
        Open focus sessions →
      </Link>
    </div>
  )
}
