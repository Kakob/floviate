import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LivingScene } from '@/components/day/living-scene'
import { SCENE_PRESETS } from '@/components/day/scenes'
import { SCENE_PRESET_KEYS, type ScenePreset } from '@/lib/day-scenes'

describe('LivingScene', () => {
  it('has a registered drawing for every scene key', () => {
    expect(Object.keys(SCENE_PRESETS).sort()).toEqual([...SCENE_PRESET_KEYS].sort())
  })

  it.each(SCENE_PRESET_KEYS)('renders the %s scene', key => {
    const { container, getByRole } = render(<LivingScene preset={key} />)
    expect(getByRole('img').getAttribute('aria-label')).toContain(SCENE_PRESETS[key].label.toLowerCase())
    expect(container.querySelectorAll('svg *').length).toBeGreaterThan(10)
  })

  it('falls back to the quiet room for a key it does not know', () => {
    const { getByRole } = render(<LivingScene preset={'volcano' as ScenePreset} />)
    expect(getByRole('img').getAttribute('aria-label')).toContain('quiet room')
  })

  it('keeps gradient ids unique when several scenes share a page', () => {
    const { container } = render(<><LivingScene preset="walking" /><LivingScene preset="walking" /></>)
    const ids = Array.from(container.querySelectorAll('[id]')).map(el => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
