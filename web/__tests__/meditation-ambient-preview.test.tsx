import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AmbientSettings, ComposedSession } from '@/lib/meditation/types'
import type { PlayerState } from '@/lib/meditation/player'
import { MeditationComposer } from '@/components/meditation/composer'
import { getMeditation } from '@/lib/meditation/content'

type PreviewAudio = {
  unlock: ReturnType<typeof vi.fn>
  recover: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  setAmbient: ReturnType<typeof vi.fn>
  onError?: (message: string) => void
}
const fakes = vi.hoisted(() => ({ audio: [] as PreviewAudio[], order: [] as string[] }))

vi.mock('@/lib/meditation/audio', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/meditation/audio')>()
  return {
    ...actual,
    BrowserAudioLayers: class {
      onError?: (message: string) => void
      unlock = vi.fn()
      recover = vi.fn()
      destroy = vi.fn(() => { fakes.order.push('preview:destroy') })
      setAmbient = vi.fn<(settings: AmbientSettings) => void>()
      constructor() { fakes.audio.push(this) }
      setErrorHandler(handler: (message: string) => void) { this.onError = handler }
    },
  }
})

vi.mock('@/lib/meditation/player', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/meditation/player')>()
  return {
    ...actual,
    MeditationPlayer: class {
      constructor(private session: ComposedSession, private onChange: (state: PlayerState) => void) { fakes.order.push('player:create') }
      start() { fakes.order.push('player:start'); this.onChange({ ...actual.createInitialPlayerState(this.session), status: 'playing' }) }
      destroy() { fakes.order.push('player:destroy') }
      recoverAmbient() {}
    },
  }
})

beforeEach(() => {
  fakes.audio.length = 0
  fakes.order.length = 0
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const meditation = getMeditation('i-got-it')!

describe('ambient sound check', () => {
  it('starts only on a tap, uses live settings, recovers, and stops without starting narration', () => {
    render(<MeditationComposer meditation={meditation} />)
    expect(fakes.audio).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Test background sounds' }))
    expect(fakes.audio).toHaveLength(1)
    const audio = fakes.audio[0]
    expect(audio.unlock).toHaveBeenCalledTimes(1)
    expect(audio.setAmbient).toHaveBeenCalledWith({ brownNoise: { enabled: true, volume: 0.75 }, rain: { enabled: true, volume: 0.75 } })
    expect(fakes.order).not.toContain('player:create')
    fireEvent.change(screen.getByRole('slider', { name: 'Rain volume' }), { target: { value: '45' } })
    expect(audio.setAmbient).toHaveBeenLastCalledWith(expect.objectContaining({ rain: { enabled: true, volume: 0.45 } }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore background sound' }))
    expect(audio.recover).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Stop sound test' }))
    expect(audio.destroy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Test background sounds' })).toBeEnabled()
    expect(screen.queryByText(/sound is playing|audio is working|sound restored/i)).not.toBeInTheDocument()
  })

  it('disables a silent test and releases it when all selected volumes become zero', () => {
    render(<MeditationComposer meditation={meditation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Test background sounds' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Rain volume' }), { target: { value: '0' } })
    fireEvent.change(screen.getByRole('slider', { name: 'Brown noise volume' }), { target: { value: '0' } })
    expect(fakes.audio[0].destroy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Test background sounds' })).toBeDisabled()
    fireEvent.change(screen.getByRole('slider', { name: 'Rain volume' }), { target: { value: '40' } })
    expect(screen.getByRole('button', { name: 'Test background sounds' })).toBeEnabled()
    expect(fakes.audio).toHaveLength(1)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rain' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Brown noise' }))
    expect(screen.getByRole('button', { name: 'Test background sounds' })).toBeDisabled()
  })

  it('destroys the preview synchronously before a session owns audio', () => {
    render(<MeditationComposer meditation={meditation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Test background sounds' }))
    fireEvent.click(screen.getByRole('button', { name: 'Begin meditation' }))
    expect(fakes.order.slice(0, 3)).toEqual(['preview:destroy', 'player:create', 'player:start'])
    expect(fakes.audio[0].destroy).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Stop sound test' })).not.toBeInTheDocument()
  })

  it('releases preview audio on hidden and unmount, without automatic restart', () => {
    const { unmount } = render(<MeditationComposer meditation={meditation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Test background sounds' }))
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(fakes.audio[0].destroy).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/sound test stopped when this page went into the background/i)).toBeInTheDocument()
    visibility.mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    expect(fakes.audio).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Test background sounds' }))
    unmount()
    expect(fakes.audio[1].destroy).toHaveBeenCalledTimes(1)
  })

  it('shows reported errors without treating an audio API response as proof of sound', () => {
    render(<MeditationComposer meditation={meditation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Test background sounds' }))
    const audio = fakes.audio[0]
    act(() => audio.onError?.('The browser blocked the audio context.'))
    expect(screen.getByRole('alert')).toHaveTextContent('browser reported an audio problem')
    fireEvent.click(screen.getByRole('button', { name: 'Restore background sound' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stop sound test' }))
    act(() => audio.onError?.('A stale audio failure.'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
