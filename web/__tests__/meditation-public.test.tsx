import type { ComponentType, ReactNode } from 'react'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resourceHref, RESOURCES } from '@/lib/meditation/resources'
import type { AmbientSettings, ComposedSession, MeditationDefinition } from '@/lib/meditation/types'
import type { PlayerState, PlayerStatus } from '@/lib/meditation/player'

const createClient = vi.hoisted(() => vi.fn())
vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const transport = vi.hoisted(() => ({ created: vi.fn(), start: vi.fn(), pause: vi.fn(), resume: vi.fn(), restart: vi.fn(), stop: vi.fn(), destroy: vi.fn(), setAmbient: vi.fn(), recoverAmbient: vi.fn() }))
vi.mock('@/lib/meditation/player', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/meditation/player')>()
  return {
    ...actual,
    MeditationPlayer: class {
      constructor(private session: ComposedSession, private onChange: (state: PlayerState) => void) { transport.created(session) }
      private emit(status: PlayerStatus) { this.onChange({ ...actual.createInitialPlayerState(this.session), status, currentEntry: this.session.timeline[0] }) }
      start() { transport.start(); this.emit('playing') }
      pause() { transport.pause(); this.emit('paused') }
      resume() { transport.resume(); this.emit('playing') }
      restart() { transport.restart(); this.emit('playing') }
      stop() { transport.stop(); this.emit('stopped') }
      destroy() { transport.destroy() }
      setAmbient(ambient: AmbientSettings) { transport.setAmbient(ambient) }
      recoverAmbient() { transport.recoverAmbient() }
    },
  }
})

let client: typeof import('@/lib/supabase-client')
let AuthProvider: ComponentType<{ children: ReactNode }>
let useAuth: typeof import('@/lib/auth-context').useAuth
let RootLayout: ComponentType<{ children: ReactNode }>
let SignInPage: ComponentType
let HomePage: ComponentType
let TrackerRouteLayout: ComponentType<{ children: ReactNode }>
let MeditationComposer: ComponentType<{ meditation: MeditationDefinition }>
let meditation: MeditationDefinition

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', undefined)
  client = await import('@/lib/supabase-client')
  ;({ AuthProvider, useAuth } = await import('@/lib/auth-context'))
  RootLayout = (await import('@/app/layout')).default
  SignInPage = (await import('@/app/sign-in/page')).default
  HomePage = (await import('@/app/page')).default
  TrackerRouteLayout = (await import('@/app/(tracker)/layout')).default
  ;({ MeditationComposer } = await import('@/components/meditation/composer'))
  meditation = (await import('@/lib/meditation/content')).getMeditation('i-got-it')!
})

afterEach(cleanup)
afterAll(() => vi.unstubAllEnvs())

describe('public meditation account isolation', () => {
  it('imports the account client without credentials or initializing Supabase', () => {
    expect(client.isSupabaseConfigured).toBe(false)
    expect(createClient).not.toHaveBeenCalled()
    expect(() => client.getSupabaseClient()).toThrow('Free meditations do not require an account')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('renders the public shell without auth or query providers', () => {
    const markup = renderToStaticMarkup(<RootLayout><main>Free meditations</main></RootLayout>)
    expect(markup).toContain('Free meditations')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('opens the free library anonymously with a playable I Got It entry', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: 'I Got It' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'I Am Strong' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'I Am Lucky' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Try a three-minute meditation' })).toHaveAttribute('href', '/meditations/i-got-it')
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /tasks|project tracker|sign in/i })).not.toBeInTheDocument()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('settles an unconfigured legacy auth provider without a request', async () => {
    function AuthStatus() {
      const { isLoading, session } = useAuth()
      return <p>{isLoading ? 'Loading' : session ? 'Signed in' : 'Anonymous'}</p>
    }
    render(<AuthProvider><AuthStatus /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('Anonymous')).toBeInTheDocument())
    expect(createClient).not.toHaveBeenCalled()
  })

  it('keeps sign-in usable without requiring account configuration', () => {
    render(<SignInPage />)
    expect(screen.getByRole('link', { name: 'Explore meditations' })).toHaveAttribute('href', '/')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('preserves the legacy auth gate without mounting task content when credentials are absent', () => {
    render(<TrackerRouteLayout><p>Private task data</p></TrackerRouteLayout>)
    expect(screen.getByRole('heading', { name: 'Account features aren’t configured' })).toBeInTheDocument()
    expect(screen.queryByText('Private task data')).not.toBeInTheDocument()
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('resource destinations', () => {
  it('never invents purchase or external destinations', () => {
    const workbook = RESOURCES.find(resource => resource.id === 'workbook')
    expect(workbook?.href).toBe(resourceHref(process.env.NEXT_PUBLIC_WORKBOOK_URL))
    expect(RESOURCES.find(resource => resource.id === 'custom')?.href).toBe(resourceHref(process.env.NEXT_PUBLIC_CUSTOM_MEDITATION_URL) ?? '/custom')
  })

  it('rejects unsafe and incomplete destinations', () => {
    for (const href of [undefined, '', 'javascript:alert(1)', 'data:text/html,test', '//example.com', '/\\example.com', '/\n/example.com', 'example.com']) {
      expect(resourceHref(href)).toBeNull()
    }
    expect(resourceHref('https://example.com/worksheet')).toBe('https://example.com/worksheet')
    expect(resourceHref('/custom')).toBe('/custom')
  })
})

describe('composer and transport integration', () => {
  it('starts only on a tap, passes settings, and releases the player on adjust and unmount', () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { unmount } = render(<MeditationComposer meditation={meditation} />)
    expect(transport.created).not.toHaveBeenCalled()
    expect(transport.start).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: 'Rain' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Brown noise' })).toBeChecked()
    expect(screen.getByRole('slider', { name: 'Rain volume' })).toHaveValue('75')
    expect(screen.getByRole('slider', { name: 'Brown noise volume' })).toHaveValue('75')
    // Both optional layers can still be switched off before beginning.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rain' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Brown noise' }))
    fireEvent.click(screen.getByRole('button', { name: 'Begin meditation' }))
    // No async work or effect is necessary before start: it runs in the tap handler.
    expect(transport.start).toHaveBeenCalledTimes(1)
    const session = transport.created.mock.calls[0][0] as ComposedSession
    expect(session.config).toMatchObject({ durationSeconds: 180, focus: 'full', narration: true, dialogue: true, ambient: { rain: { enabled: false, volume: 0.75 }, brownNoise: { enabled: false, volume: 0.75 } } })
    expect(session.timeline.some(entry => entry.type === 'cinematic-dialogue')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Pause meditation' }))
    expect(transport.pause).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Restore background sound' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Resume meditation' }))
    expect(transport.resume).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Restore background sound' }))
    expect(transport.recoverAmbient).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rain' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Rain volume' }), { target: { value: '40' } })
    expect(transport.setAmbient).toHaveBeenLastCalledWith(expect.objectContaining({ rain: { enabled: true, volume: 0.4 } }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rain' }))
    expect(transport.setAmbient).toHaveBeenLastCalledWith(expect.objectContaining({ rain: { enabled: false, volume: 0.4 } }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop meditation' }))
    expect(transport.stop).toHaveBeenCalledTimes(1)
    expect(screen.getByText('SESSION STOPPED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore background sound' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Restart meditation' }))
    expect(transport.restart).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Adjust your meditation' }))
    expect(transport.destroy).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Begin meditation' }))
    expect(transport.start).toHaveBeenCalledTimes(2)
    unmount()
    expect(transport.destroy).toHaveBeenCalledTimes(2)
    expect(createClient).not.toHaveBeenCalled()
    scroll.mockRestore()
  })

  it('prevents playback for an invalid custom duration', () => {
    render(<MeditationComposer meditation={meditation} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Seconds (10–900)' }), { target: { value: '9' } })
    expect(screen.getByRole('button', { name: 'Begin meditation' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('between 10 and 900 seconds')
  })
})
