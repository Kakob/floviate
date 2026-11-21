import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserAudioLayers } from '../lib/meditation/audio'
import type { AmbientSettings } from '../lib/meditation/types'

const quiet: AmbientSettings = {
  brownNoise: { enabled: false, volume: 0.25 },
  rain: { enabled: false, volume: 0.3 },
}
const ambient: AmbientSettings = {
  brownNoise: { enabled: true, volume: 0.25 },
  rain: { enabled: true, volume: 0.3 },
}

function audioNode() {
  return { connect: vi.fn((target: unknown) => target), disconnect: vi.fn() }
}

function sourceNode() {
  return { ...audioNode(), start: vi.fn(), stop: vi.fn(), buffer: null, loop: false }
}

function browserAudio(onConstruct: () => void = () => {}, onResume: () => void = () => {}) {
  const events = new EventTarget()
  const sources: ReturnType<typeof sourceNode>[] = []
  const context = {
    state: 'suspended', sampleRate: 100, currentTime: 0, destination: {},
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => events.addEventListener(type, listener)),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => events.removeEventListener(type, listener)),
    resume: vi.fn<() => Promise<void>>(),
    suspend: vi.fn<() => Promise<void>>(),
    close: vi.fn<() => Promise<void>>(),
    createBuffer: vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) })),
    createBufferSource: vi.fn(() => { const source = sourceNode(); sources.push(source); return source }),
    createGain: vi.fn(() => ({ ...audioNode(), gain: { value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } })),
    createBiquadFilter: vi.fn(() => ({ ...audioNode(), type: '', frequency: { value: 0 } })),
  }
  const changeState = (state: string) => { context.state = state; events.dispatchEvent(new Event('statechange')) }
  context.resume.mockImplementation(async () => { onResume(); changeState('running') })
  context.suspend.mockImplementation(async () => { changeState('suspended') })
  context.close.mockImplementation(async () => { changeState('closed') })
  vi.stubGlobal('AudioContext', class { constructor() { onConstruct(); return context } })
  return { context, sources, changeState }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('mobile ambient audio activation', () => {
  it('selects media playback before constructing and resuming audio in the Play gesture', () => {
    const order: string[] = []
    let type = 'auto'
    const audioSession = {
      get type() { return type },
      set type(value: string) { type = value; order.push(`session:${value}`) },
    }
    vi.stubGlobal('navigator', { audioSession })
    browserAudio(() => order.push(`construct:${type}`), () => order.push(`resume:${type}`))
    const audio = new BrowserAudioLayers()
    audio.setAmbient(ambient)
    audio.unlock()
    order.push('gesture returned')
    expect(order.indexOf('session:playback')).toBeLessThan(order.indexOf('construct:playback'))
    expect(order.indexOf('construct:playback')).toBeLessThan(order.indexOf('resume:playback'))
    expect(order.indexOf('resume:playback')).toBeLessThan(order.indexOf('gesture returned'))
    audio.destroy()
  })

  it.each(['stop', 'destroy'] as const)('restores the previously selected session type on %s', method => {
    const audioSession = { type: 'ambient' }
    vi.stubGlobal('navigator', { audioSession })
    browserAudio()
    const audio = new BrowserAudioLayers()
    audio.unlock()
    expect(audioSession.type).toBe('playback')
    audio[method]()
    expect(audioSession.type).toBe('ambient')
    audio.destroy()
  })

  it('does not overwrite a session category changed by another audio owner', () => {
    const audioSession = { type: 'auto' }
    vi.stubGlobal('navigator', { audioSession })
    browserAudio()
    const audio = new BrowserAudioLayers()
    audio.unlock()
    audioSession.type = 'play-and-record'
    audio.stop()
    expect(audioSession.type).toBe('play-and-record')
    audio.destroy()
  })

  it.each(['missing', 'getter throws', 'setter throws'])('keeps Web Audio usable when Audio Session API is %s', mode => {
    const navigatorStub = mode === 'getter throws'
      ? { get audioSession(): never { throw new Error('Unsupported session access') } }
      : mode === 'setter throws'
        ? { audioSession: { get type() { return 'auto' }, set type(_value: string) { throw new Error('Unsupported category') } } }
        : {}
    vi.stubGlobal('navigator', navigatorStub)
    const { context, sources } = browserAudio()
    const audio = new BrowserAudioLayers()
    const failed = vi.fn()
    audio.setErrorHandler(failed)
    audio.setAmbient(ambient)
    expect(() => audio.unlock()).not.toThrow()
    expect(context.resume).toHaveBeenCalledOnce()
    expect(sources).toHaveLength(2)
    expect(failed).not.toHaveBeenCalled()
    expect(() => audio.destroy()).not.toThrow()
  })

  it.each(['suspended', 'interrupted'])('uses a live ambient toggle to resume a %s context without duplicating layers', state => {
    const { context, sources } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.setAmbient(quiet)
    audio.unlock()
    context.state = state
    const previousResumes = context.resume.mock.calls.length
    audio.setAmbient(ambient)
    expect(context.resume).toHaveBeenCalledTimes(previousResumes + 1)
    expect(context.state).toBe('running')
    expect(sources).toHaveLength(2)
    expect(sources.every(source => source.start.mock.calls.length === 1)).toBe(true)
    audio.destroy()
  })

  it('does not activate audio from settings before Play or while paused', async () => {
    const { context, sources } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.setAmbient(ambient)
    expect(context.resume).not.toHaveBeenCalled()
    expect(sources).toHaveLength(0)
    audio.unlock()
    audio.pause()
    await Promise.resolve()
    const previousResumes = context.resume.mock.calls.length
    audio.setAmbient(ambient)
    expect(context.resume).toHaveBeenCalledTimes(previousResumes)
    expect(context.state).toBe('suspended')
    audio.destroy()
  })
})

describe('mobile ambient interruptions and cleanup', () => {
  it.each(['interrupted', 'suspended'])('attempts recovery once per %s episode and allows a new episode after running', async state => {
    const { context, sources, changeState } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.setAmbient(ambient)
    audio.unlock()
    const initialResumes = context.resume.mock.calls.length
    context.resume.mockImplementation(async () => {})
    changeState(state)
    changeState(state)
    await Promise.resolve()
    changeState(state)
    expect(context.resume).toHaveBeenCalledTimes(initialResumes + 1)
    changeState('running')
    changeState(state)
    expect(context.resume).toHaveBeenCalledTimes(initialResumes + 2)
    expect(sources).toHaveLength(2)
    audio.destroy()
  })

  it('removes the interruption listener and releases both layers on stop', () => {
    const { context, sources, changeState } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.setAmbient(ambient)
    audio.unlock()
    const listener = context.addEventListener.mock.calls.find(([type]) => type === 'statechange')?.[1]
    expect(listener).toBeDefined()
    audio.stop()
    expect(context.removeEventListener).toHaveBeenCalledWith('statechange', listener)
    const previousResumes = context.resume.mock.calls.length
    changeState('interrupted')
    expect(context.resume).toHaveBeenCalledTimes(previousResumes)
    expect(context.close).toHaveBeenCalledOnce()
    expect(sources.every(source => source.stop.mock.calls.length === 1 && source.disconnect.mock.calls.length === 1)).toBe(true)
    audio.destroy()
  })

  it('ignores a late recovery rejection after destruction', async () => {
    const { context, changeState } = browserAudio()
    const audio = new BrowserAudioLayers()
    const failed = vi.fn()
    audio.setErrorHandler(failed)
    audio.setAmbient(ambient)
    audio.unlock()
    let rejectResume!: (reason: Error) => void
    context.resume.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectResume = reject }))
    changeState('interrupted')
    expect(rejectResume).toBeTypeOf('function')
    audio.destroy()
    rejectResume(new Error('The old context was closed'))
    await Promise.resolve()
    expect(failed).not.toHaveBeenCalled()
    expect(context.close).toHaveBeenCalledOnce()
  })
})

describe('user-requested background sound recovery', () => {
  it('cycles the session category across tasks while retaining the context, layers, and original category', () => {
    const audioSession = { type: 'transient' }
    vi.stubGlobal('navigator', { audioSession })
    const { context, sources } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.setAmbient(ambient)
    audio.unlock()
    expect(audioSession.type).toBe('playback')
    audio.recover()
    expect(audioSession.type).toBe('ambient')
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(0)
    expect(audioSession.type).toBe('playback')
    expect(sources).toHaveLength(2)
    expect(sources.every(source => source.start.mock.calls.length === 1 && source.stop.mock.calls.length === 0)).toBe(true)
    expect(context.close).not.toHaveBeenCalled()
    audio.stop()
    expect(audioSession.type).toBe('transient')
    expect(vi.getTimerCount()).toBe(0)
    audio.destroy()
  })

  it('keeps at most one pending category reset after repeated recovery taps', () => {
    const audioSession = { type: 'auto' }
    vi.stubGlobal('navigator', { audioSession })
    const { sources } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.unlock()
    audio.recover()
    audio.recover()
    audio.recover()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(0)
    expect(audioSession.type).toBe('playback')
    expect(vi.getTimerCount()).toBe(0)
    expect(sources).toHaveLength(2)
    audio.destroy()
    expect(audioSession.type).toBe('auto')
  })

  it.each(['pause', 'stop', 'destroy'] as const)('cancels pending recovery on %s without letting a late callback reactivate it', method => {
    const audioSession = { type: 'auto' }
    vi.stubGlobal('navigator', { audioSession })
    const { context } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.unlock()
    const scheduled = vi.spyOn(globalThis, 'setTimeout')
    audio.recover()
    expect(audioSession.type).toBe('ambient')
    const lateReset = scheduled.mock.calls.find(([, delay]) => delay === 0)?.[0]
    expect(lateReset).toBeTypeOf('function')
    audio[method]()
    const expectedType = method === 'pause' ? 'playback' : 'auto'
    expect(audioSession.type).toBe(expectedType)
    expect(vi.getTimerCount()).toBe(0)
    const previousResumes = context.resume.mock.calls.length
    if (typeof lateReset === 'function') lateReset()
    vi.runAllTimers()
    expect(context.resume).toHaveBeenCalledTimes(previousResumes)
    expect(audioSession.type).toBe(expectedType)
    audio.destroy()
    expect(audioSession.type).toBe('auto')
  })

  it.each(['pending task', 'pause', 'stop'] as const)('preserves an external session category change during recovery at %s', step => {
    const audioSession = { type: 'auto' }
    vi.stubGlobal('navigator', { audioSession })
    browserAudio()
    const audio = new BrowserAudioLayers()
    audio.unlock()
    audio.recover()
    audioSession.type = 'play-and-record'
    if (step === 'pending task') vi.advanceTimersByTime(0)
    else audio[step]()
    expect(audioSession.type).toBe('play-and-record')
    audio.destroy()
    vi.runAllTimers()
    expect(audioSession.type).toBe('play-and-record')
  })

  it('does nothing before playback, while paused, or after destruction', async () => {
    const audioSession = { type: 'auto' }
    vi.stubGlobal('navigator', { audioSession })
    const { context, sources } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.recover()
    expect(audioSession.type).toBe('auto')
    expect(context.resume).not.toHaveBeenCalled()
    expect(sources).toHaveLength(0)
    audio.unlock()
    audio.pause()
    await Promise.resolve()
    const previousResumes = context.resume.mock.calls.length
    audio.recover()
    expect(audioSession.type).toBe('playback')
    expect(context.resume).toHaveBeenCalledTimes(previousResumes)
    expect(vi.getTimerCount()).toBe(0)
    audio.destroy()
    audio.recover()
    expect(audioSession.type).toBe('auto')
    expect(context.resume).toHaveBeenCalledTimes(previousResumes)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resumes the existing context when Audio Session is unavailable', () => {
    vi.stubGlobal('navigator', {})
    const { context, sources } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.unlock()
    context.state = 'interrupted'
    const previousResumes = context.resume.mock.calls.length
    audio.recover()
    expect(context.resume).toHaveBeenCalledTimes(previousResumes + 1)
    expect(context.state).toBe('running')
    expect(sources).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(0)
    audio.destroy()
  })

  it.each(['read', 'write', 'restore'] as const)('keeps experimental Audio Session %s errors nonfatal during recovery', mode => {
    let type = 'auto'
    let broken = false
    const audioSession = {
      get type() { if (broken && mode === 'read') throw new Error('Session access withdrawn'); return type },
      set type(value: string) {
        if (broken && (mode === 'write' || (mode === 'restore' && value === 'playback'))) throw new Error('Category unsupported')
        type = value
      },
    }
    vi.stubGlobal('navigator', { audioSession })
    const { context, sources } = browserAudio()
    const audio = new BrowserAudioLayers()
    const failed = vi.fn()
    audio.setErrorHandler(failed)
    audio.setAmbient(ambient)
    audio.unlock()
    broken = true
    context.state = 'suspended'
    const previousResumes = context.resume.mock.calls.length
    expect(() => audio.recover()).not.toThrow()
    expect(() => vi.runAllTimers()).not.toThrow()
    expect(context.resume.mock.calls.length).toBeGreaterThan(previousResumes)
    expect(failed).not.toHaveBeenCalled()
    expect(sources).toHaveLength(2)
    expect(() => audio.destroy()).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('ambient recovery after each completed spoken sentence', () => {
  it.each(['suspended', 'interrupted'])('retries a %s context after each sentence without cycling its category', async state => {
    const categoryChanges: string[] = []
    let type = 'auto'
    vi.stubGlobal('navigator', { audioSession: {
      get type() { return type },
      set type(value: string) { type = value; categoryChanges.push(value) },
    } })
    const { context, sources, changeState } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.setAmbient(ambient)
    audio.unlock()
    context.resume.mockImplementation(async () => {})
    changeState(state)
    await Promise.resolve()
    const previousResumes = context.resume.mock.calls.length
    const previousCategoryChanges = [...categoryChanges]
    audio.afterSpeech()
    expect(context.resume).toHaveBeenCalledTimes(previousResumes + 1)
    await Promise.resolve()
    audio.afterSpeech()
    expect(context.resume).toHaveBeenCalledTimes(previousResumes + 2)
    expect(categoryChanges).toEqual(previousCategoryChanges)
    expect(vi.getTimerCount()).toBe(0)
    expect(sources).toHaveLength(2)
    audio.destroy()
  })

  it('leaves already running audio alone and ignores sentence callbacks while paused or destroyed', async () => {
    const { context } = browserAudio()
    const audio = new BrowserAudioLayers()
    audio.afterSpeech()
    expect(context.resume).not.toHaveBeenCalled()
    audio.unlock()
    const previousResumes = context.resume.mock.calls.length
    audio.afterSpeech()
    expect(context.resume).toHaveBeenCalledTimes(previousResumes)
    audio.pause()
    await Promise.resolve()
    audio.afterSpeech()
    expect(context.resume).toHaveBeenCalledTimes(previousResumes)
    audio.destroy()
    audio.afterSpeech()
    expect(context.resume).toHaveBeenCalledTimes(previousResumes)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores a sentence-recovery rejection after the session is stopped', async () => {
    const { context } = browserAudio()
    const audio = new BrowserAudioLayers()
    const failed = vi.fn()
    audio.setErrorHandler(failed)
    audio.setAmbient(ambient)
    audio.unlock()
    context.state = 'interrupted'
    let rejectResume!: (reason: Error) => void
    context.resume.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectResume = reject }))
    audio.afterSpeech()
    expect(rejectResume).toBeTypeOf('function')
    audio.stop()
    rejectResume(new Error('Old context released'))
    await Promise.resolve()
    expect(failed).not.toHaveBeenCalled()
    expect(context.close).toHaveBeenCalledOnce()
    audio.destroy()
  })
})
