import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserAudioLayers, BrowserSpeechService, type AudioLayers, type PlaybackHandle, type SpeechService } from '../lib/meditation/audio'
import { MeditationPlayer, type PlayerState } from '../lib/meditation/player'
import type { AmbientSettings, ComposedSession, TimelineEntry } from '../lib/meditation/types'
import { composeSession } from '../lib/meditation/compose'
import { getMeditation } from '../lib/meditation/content'
import { DEFAULT_CONFIG } from '../lib/meditation/defaults'

const ambient: AmbientSettings = { brownNoise: { enabled: true, volume: 0.25 }, rain: { enabled: true, volume: 0.3 } }
function session(entries: Partial<TimelineEntry>[] = [
  { id: 'intro', durationSeconds: 2, text: 'Remember a moment of capability.' },
  { id: 'hold', durationSeconds: 3, type: 'silent-hold', text: '' },
  { id: 'dialogue', durationSeconds: 2, type: 'cinematic-dialogue', characterId: 'friend', text: 'I got it.' },
]): ComposedSession {
  let startSeconds = 0
  const timeline = entries.map((entry, index): TimelineEntry => {
    const result: TimelineEntry = { id: `entry-${index}`, unitId: `unit-${index}`, type: 'narration', phase: 'past', text: '', durationSeconds: 1, scriptVersion: '1', ...entry, startSeconds }
    startSeconds += result.durationSeconds
    return result
  })
  return { id: 'test-session', meditationId: 'i-got-it', title: 'I Got It', contentVersion: '1', config: { meditationId: 'i-got-it', durationSeconds: startSeconds, focus: 'full', narration: true, dialogue: true, ambient }, timeline, totalDurationSeconds: startSeconds, timing: 'estimated', warnings: [] }
}
function playback(): PlaybackHandle { return { pause: vi.fn(), resume: vi.fn(), stop: vi.fn() } }
function harness(composed = session(), documentDependency: Document | null = null) {
  const spoken: { entry: TimelineEntry; end: () => void; fail: (message: string) => void; handle: PlaybackHandle }[] = []
  const recorded: { end: () => void; fail: (message: string) => void; handle: PlaybackHandle }[] = []
  const speech: SpeechService = {
    setSentenceEndHandler: vi.fn(),
    unlock: vi.fn(),
    speak: vi.fn((entry, _voice, _character, end, fail) => { const handle = playback(); spoken.push({ entry, end, fail, handle }); return handle }), stop: vi.fn(),
  }
  const audio: AudioLayers = {
    recover: vi.fn(), afterSpeech: vi.fn(),
    unlock: vi.fn(), setAmbient: vi.fn(), pause: vi.fn(), resume: vi.fn(), stop: vi.fn(), destroy: vi.fn(),
    playRecording: vi.fn((_asset, end, fail) => { const handle = playback(); recorded.push({ end, fail, handle }); return handle }),
  }
  const states: PlayerState[] = []
  const player = new MeditationPlayer(composed, state => states.push(state), { audio, speech, document: documentDependency, now: () => Date.now(), setTicker: callback => setInterval(callback, 100), clearTicker: ticker => clearInterval(ticker) })
  return { player, states, spoken, recorded, audio, speech }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('MeditationPlayer session transport', () => {
  it('retries background audio after speech and on request without restarting the session', () => {
    const { player, audio, speech, spoken } = harness()
    const sentenceEnded = vi.mocked(speech.setSentenceEndHandler!).mock.calls[0][0]
    player.recoverAmbient()
    expect(audio.recover).not.toHaveBeenCalled()
    player.start()
    vi.advanceTimersByTime(700)
    player.recoverAmbient()
    // System audio-mode recovery waits until native speech is between sentences.
    expect(audio.recover).not.toHaveBeenCalled()
    sentenceEnded()
    expect(audio.recover).toHaveBeenCalledOnce()
    sentenceEnded()
    expect(audio.afterSpeech).toHaveBeenCalledOnce()
    expect(player.getState().elapsedSeconds).toBe(0.7)
    expect(spoken).toHaveLength(1)
    player.pause()
    sentenceEnded()
    player.recoverAmbient()
    expect(audio.afterSpeech).toHaveBeenCalledOnce()
    expect(audio.recover).toHaveBeenCalledOnce()
    player.destroy()
    sentenceEnded()
    player.recoverAmbient()
    expect(audio.afterSpeech).toHaveBeenCalledOnce()
    expect(audio.recover).toHaveBeenCalledOnce()
  })
  it('turns a thrown audio initialization error into recoverable player state', () => {
    const { player, audio, spoken } = harness()
    vi.mocked(audio.unlock).mockImplementation(() => { throw new Error('AudioContext unavailable') })
    expect(() => player.start()).not.toThrow()
    expect(player.getState()).toMatchObject({ status: 'error', error: expect.stringContaining('Audio could not start') })
    expect(spoken).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
    player.destroy()
  })
  it('unlocks Safari speech from Play when the first spoken entry follows silence', () => {
    const { player, speech, spoken } = harness(session([{ type: 'silent-hold', text: '', durationSeconds: 1 }, { text: 'I got it.' }]))
    player.start()
    expect(speech.unlock).toHaveBeenCalledOnce()
    expect(spoken).toHaveLength(0)
    vi.advanceTimersByTime(1000)
    expect(spoken).toHaveLength(1)
    player.destroy()
  })
  it('does not leave a timer when a native resume synchronously fails', () => {
    const { player, spoken } = harness()
    player.start()
    player.pause()
    vi.mocked(spoken[0].handle.resume).mockImplementation(() => spoken[0].fail('The speech queue was released. Restart.'))
    player.resume()
    expect(player.getState().status).toBe('error')
    expect(vi.getTimerCount()).toBe(0)
    player.destroy()
  })
  it('runs the authored three-minute I Got It journey through every full spoken unit', () => {
    const composed = composeSession(getMeditation('i-got-it')!, DEFAULT_CONFIG)
    const { player, spoken } = harness(composed)
    const ended = new Set<string>()
    player.start()
    for (let tick = 0; tick < 1800; tick++) {
      const current = spoken[spoken.length - 1]
      if (current && !ended.has(current.entry.id) && player.getState().elapsedSeconds >= current.entry.startSeconds + current.entry.durationSeconds * 0.8) {
        ended.add(current.entry.id)
        current.end()
      }
      vi.advanceTimersByTime(100)
    }
    expect(spoken.map(item => item.entry.id)).toEqual(composed.timeline.filter(entry => entry.text.trim()).map(entry => entry.id))
    expect(spoken.some(item => item.entry.type === 'cinematic-dialogue')).toBe(true)
    expect(player.getState()).toMatchObject({ status: 'completed', elapsedSeconds: 180, timingDriftSeconds: 0 })
    player.destroy()
  })
  it('plays complete spoken units in order, holds silence, and finishes normally', () => {
    const { player, spoken, audio } = harness()
    player.start()
    expect(spoken.map(item => item.entry.id)).toEqual(['intro'])
    vi.advanceTimersByTime(1000)
    spoken[0].end()
    expect(player.getState().currentEntry?.id).toBe('intro')
    vi.advanceTimersByTime(1000)
    expect(player.getState().currentEntry?.id).toBe('hold')
    expect(audio.stop).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000)
    expect(spoken.map(item => item.entry.id)).toEqual(['intro', 'dialogue'])
    vi.advanceTimersByTime(1000)
    spoken[1].end()
    vi.advanceTimersByTime(1000)
    expect(player.getState()).toMatchObject({ status: 'completed', elapsedSeconds: 7, remainingSeconds: 0, timingDriftSeconds: 0, currentEntry: null })
    expect(audio.stop).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    player.destroy()
  })
  it('freezes one clock and resumes the same utterance without queuing it twice', () => {
    const { player, spoken, audio } = harness()
    player.start()
    vi.advanceTimersByTime(700)
    player.pause()
    expect(spoken[0].handle.pause).toHaveBeenCalledOnce()
    expect(audio.pause).toHaveBeenCalledOnce()
    expect(player.getState().elapsedSeconds).toBe(0.7)
    vi.advanceTimersByTime(5000)
    expect(player.getState().elapsedSeconds).toBe(0.7)
    player.resume()
    player.resume()
    expect(spoken[0].handle.resume).toHaveBeenCalledOnce()
    expect(audio.resume).toHaveBeenCalledOnce()
    expect(spoken).toHaveLength(1)
    vi.advanceTimersByTime(300)
    spoken[0].end()
    vi.advanceTimersByTime(1000)
    expect(player.getState().elapsedSeconds).toBe(2)
    expect(player.getState().currentEntry?.id).toBe('hold')
    player.destroy()
  })
  it('lets a full line overrun its estimate and reports additional duration', () => {
    const { player, spoken } = harness()
    player.start()
    vi.advanceTimersByTime(3500)
    expect(spoken).toHaveLength(1)
    expect(player.getState()).toMatchObject({ status: 'playing', timingDriftSeconds: 1.5, remainingSeconds: 5 })
    spoken[0].end()
    expect(player.getState().currentEntry?.id).toBe('hold')
    vi.advanceTimersByTime(3000)
    expect(spoken).toHaveLength(2)
    spoken[1].end()
    vi.advanceTimersByTime(2000)
    expect(player.getState()).toMatchObject({ status: 'completed', elapsedSeconds: 8.5, timingDriftSeconds: 1.5 })
    player.destroy()
  })
  it('ignores late callbacks from prior entries and stopped or restarted sessions', () => {
    const { player, spoken } = harness()
    player.start()
    const first = spoken[0]
    vi.advanceTimersByTime(2000)
    first.end()
    expect(player.getState().currentEntry?.id).toBe('hold')
    first.fail('Late browser error')
    expect(player.getState().status).toBe('playing')
    player.restart()
    first.end()
    first.fail('Another late browser error')
    expect(player.getState()).toMatchObject({ status: 'playing', elapsedSeconds: 0, error: null })
    expect(spoken).toHaveLength(2)
    player.stop()
    spoken[1].end()
    vi.advanceTimersByTime(5000)
    expect(player.getState().status).toBe('stopped')
    expect(spoken).toHaveLength(2)
    player.destroy()
  })
  it('cancels audio, timers, and callbacks on unmount', () => {
    const { player, spoken, audio, speech, states } = harness()
    player.start()
    const stateCount = states.length
    player.destroy()
    player.destroy()
    expect(spoken[0].handle.stop).toHaveBeenCalled()
    expect(speech.stop).toHaveBeenCalled()
    expect(audio.destroy).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    spoken[0].end()
    player.start()
    player.resume()
    expect(states).toHaveLength(stateCount)
  })
  it('pauses when hidden and requires an explicit resume', () => {
    const { player, audio } = harness(session(), document)
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    player.start()
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(player.getState().status).toBe('paused')
    expect(player.getState().error).toContain('background')
    expect(audio.pause).toHaveBeenCalledOnce()
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(player.getState().status).toBe('paused')
    player.resume()
    expect(player.getState()).toMatchObject({ status: 'playing', error: null })
    player.destroy()
  })
  it('stops audio and explains speech failures instead of substituting captions', () => {
    const { player, spoken, audio } = harness()
    player.start()
    spoken[0].fail('Spoken audio is unavailable. Please restart.')
    expect(player.getState()).toMatchObject({ status: 'error', error: 'Spoken audio is unavailable. Please restart.' })
    expect(audio.stop).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    player.destroy()
  })
  it('changes ambient layers independently without restarting narration', () => {
    const { player, spoken, audio } = harness()
    player.start()
    const changed = { brownNoise: { enabled: false, volume: 0.1 }, rain: { enabled: true, volume: 0.7 } }
    player.setAmbient(changed)
    expect(audio.setAmbient).toHaveBeenLastCalledWith(changed)
    expect(spoken).toHaveLength(1)
    player.destroy()
  })
})

describe('recorded clip selection and fallback', () => {
  const asset = { src: '/audio/narration.wav', durationSeconds: 2, scriptVersion: '1' }
  it('plays a matching recording instead of TTS', () => {
    const { player, recorded, spoken } = harness(session([{ text: 'A complete line.', durationSeconds: 2, audio: asset }]))
    player.start()
    expect(recorded).toHaveLength(1)
    expect(spoken).toHaveLength(0)
    vi.advanceTimersByTime(1000)
    recorded[0].end()
    vi.advanceTimersByTime(1000)
    expect(player.getState().status).toBe('completed')
    player.destroy()
  })
  it('falls back to the complete script if a recording cannot load', () => {
    const { player, recorded, spoken } = harness(session([{ text: 'A complete line.', audio: asset }]))
    player.start()
    recorded[0].fail('404')
    expect(recorded[0].handle.stop).toHaveBeenCalled()
    expect(spoken.map(item => item.entry.text)).toEqual(['A complete line.'])
    expect(player.getState().status).toBe('playing')
    player.destroy()
  })
  it('does not start fallback speech while paused', () => {
    const { player, recorded, spoken } = harness(session([{ text: 'A complete line.', audio: asset }]))
    player.start()
    player.pause()
    recorded[0].fail('404')
    expect(spoken).toHaveLength(0)
    player.resume()
    expect(spoken).toHaveLength(1)
    player.destroy()
  })
  it('ignores outdated recordings and speaks edited words', () => {
    const { player, recorded, spoken } = harness(session([{ text: 'An edited line.', scriptVersion: '2', audio: asset }]))
    player.start()
    expect(recorded).toHaveLength(0)
    expect(spoken[0].entry.text).toBe('An edited line.')
    player.destroy()
  })
})

describe('browser audio cleanup', () => {
  it('reports unsupported background sound but allows speech-only playback', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    const audio = new BrowserAudioLayers()
    const failed = vi.fn()
    audio.setErrorHandler(failed)
    audio.setAmbient({ brownNoise: { enabled: false, volume: 0.3 }, rain: { enabled: false, volume: 0.3 } })
    audio.unlock()
    expect(failed).not.toHaveBeenCalled()
    audio.setAmbient(ambient)
    expect(failed).toHaveBeenCalledWith(expect.stringContaining('unavailable'))
    audio.destroy()
  })
  it('reports a throwing AudioContext constructor without leaking an exception', () => {
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('Audio device unavailable') } })
    const audio = new BrowserAudioLayers()
    const failed = vi.fn()
    audio.setErrorHandler(failed)
    audio.setAmbient(ambient)
    expect(() => audio.unlock()).not.toThrow()
    expect(failed).toHaveBeenCalledWith(expect.stringContaining('could not start'))
    audio.destroy()
  })
  it('uses independent ambience gains and releases sources and context', async () => {
    const sources: { stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = []
    const gains: { setTargetAtTime: ReturnType<typeof vi.fn> }[] = []
    const node = () => {
      const result = { connect: vi.fn(), disconnect: vi.fn() }
      result.connect.mockImplementation((target: unknown) => target)
      return result
    }
    const context = {
      state: 'suspended', sampleRate: 100, currentTime: 0, destination: {},
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      resume: vi.fn(async () => { context.state = 'running' }),
      suspend: vi.fn(async () => { context.state = 'suspended' }),
      close: vi.fn(async () => { context.state = 'closed' }),
      createBuffer: vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) })),
      createBufferSource: vi.fn(() => { const source = { ...node(), start: vi.fn(), stop: vi.fn(), buffer: null, loop: false }; sources.push(source); return source }),
      createGain: vi.fn(() => { const gain = { value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() }; gains.push(gain); return { ...node(), gain } }),
      createBiquadFilter: vi.fn(() => ({ ...node(), type: '', frequency: { value: 0 } })),
    }
    vi.stubGlobal('AudioContext', class { constructor() { return context } })
    const audio = new BrowserAudioLayers()
    audio.setAmbient(ambient)
    audio.unlock()
    expect(sources).toHaveLength(2)
    expect(gains[1].setTargetAtTime).toHaveBeenLastCalledWith(0.25, 0, 0.08)
    expect(gains[2].setTargetAtTime).toHaveBeenLastCalledWith(0.3, 0, 0.08)
    audio.setAmbient({ brownNoise: { enabled: false, volume: 1 }, rain: { enabled: true, volume: 0.6 } })
    expect(gains[1].setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.08)
    expect(gains[2].setTargetAtTime).toHaveBeenLastCalledWith(0.6, 0, 0.08)
    audio.pause()
    await Promise.resolve()
    expect(context.suspend).toHaveBeenCalledOnce()
    audio.resume()
    expect(sources).toHaveLength(2)
    expect(context.resume).toHaveBeenCalledTimes(2)
    let suspended!: () => void
    context.suspend.mockImplementationOnce(() => new Promise<void>(resolve => { suspended = () => { context.state = 'suspended'; resolve() } }))
    audio.pause()
    audio.resume()
    suspended()
    await Promise.resolve()
    expect(context.state).toBe('running')
    expect(context.resume).toHaveBeenCalledTimes(4)
    audio.destroy()
    expect(sources.every(source => source.stop.mock.calls.length === 1 && source.disconnect.mock.calls.length === 1)).toBe(true)
    expect(context.close).toHaveBeenCalledOnce()
    audio.unlock()
    expect(sources).toHaveLength(2)
    // A rejection from a closed previous context cannot fail a new session.
    let rejectResume!: (error: Error) => void
    context.state = 'suspended'
    context.resume.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectResume = reject }))
    const lateAudio = new BrowserAudioLayers()
    const lateError = vi.fn()
    lateAudio.setErrorHandler(lateError)
    lateAudio.setAmbient(ambient)
    lateAudio.unlock()
    lateAudio.destroy()
    rejectResume(new Error('Not allowed'))
    await Promise.resolve()
    expect(lateError).not.toHaveBeenCalled()
    // Current permission failures are visible and release audio resources.
    context.state = 'suspended'
    context.resume.mockRejectedValueOnce(new Error('Not allowed'))
    const blockedAudio = new BrowserAudioLayers()
    const blockedError = vi.fn()
    blockedAudio.setErrorHandler(blockedError)
    blockedAudio.setAmbient(ambient)
    blockedAudio.unlock()
    await Promise.resolve()
    expect(blockedError).toHaveBeenCalledWith(expect.stringContaining('blocked'))
    expect(context.state).toBe('closed')
    blockedAudio.destroy()
  })
  it('keeps the same utterance on pause/resume and removes event handlers on stop', () => {
    const utterances: SpeechSynthesisUtterance[] = []
    const synthesis = { speak: vi.fn((utterance: SpeechSynthesisUtterance) => utterances.push(utterance)), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: () => [] }
    vi.stubGlobal('speechSynthesis', synthesis)
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
    const service = new BrowserSpeechService()
    const handle = service.speak(session().timeline[0], undefined, 0, vi.fn(), vi.fn())
    handle.pause()
    handle.resume()
    expect(synthesis.speak).toHaveBeenCalledOnce()
    expect(synthesis.pause).toHaveBeenCalledOnce()
    expect(synthesis.resume).toHaveBeenCalledTimes(2)
    const queuedError = utterances[0].onerror
    const queuedEnd = utterances[0].onend
    handle.stop()
    expect(synthesis.cancel).toHaveBeenCalledOnce()
    expect(utterances[0].onend).toBeNull()
    expect(utterances[0].onerror).toBeNull()
    queuedError?.call(utterances[0], { error: 'canceled' } as SpeechSynthesisErrorEvent)
    queuedEnd?.call(utterances[0], {} as SpeechSynthesisEvent)
    expect(synthesis.speak).toHaveBeenCalledOnce()
  })
  it('selects a saved voiceURI and reports a discarded Safari utterance on Resume', () => {
    const voice = { name: 'Ava', voiceURI: 'com.apple.voice.Ava', lang: 'en-US', localService: true, default: false } as SpeechSynthesisVoice
    const utterances: SpeechSynthesisUtterance[] = []
    const synthesis = { speak: vi.fn((utterance: SpeechSynthesisUtterance) => utterances.push(utterance)), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: () => [voice], speaking: true, pending: false }
    vi.stubGlobal('speechSynthesis', synthesis)
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
    const service = new BrowserSpeechService()
    const failed = vi.fn()
    const handle = service.speak(session().timeline[0], voice.voiceURI, 0, vi.fn(), failed)
    expect(utterances[0].voice).toBe(voice)
    handle.pause()
    handle.resume()
    utterances[0].onpause?.call(utterances[0], {} as SpeechSynthesisEvent)
    expect(synthesis.resume).toHaveBeenCalledTimes(3)
    handle.pause()
    synthesis.speaking = false
    handle.resume()
    expect(failed).toHaveBeenCalledWith(expect.stringContaining('Press Restart'))
    expect(synthesis.speak).toHaveBeenCalledOnce()
  })
  it('prefers a natural default narrator over alphabetically earlier novelty voices', () => {
    const voice = (name: string, defaultVoice = false) => ({ name, voiceURI: name, lang: 'en-US', localService: true, default: defaultVoice }) as SpeechSynthesisVoice
    const samantha = voice('Samantha', true)
    const utterances: SpeechSynthesisUtterance[] = []
    vi.stubGlobal('speechSynthesis', { speak: (utterance: SpeechSynthesisUtterance) => utterances.push(utterance), cancel: vi.fn(), resume: vi.fn(), getVoices: () => [voice('Albert'), voice('Bad News'), voice('Daniel'), samantha] })
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
    const service = new BrowserSpeechService()
    service.speak(session().timeline[0], undefined, 0, vi.fn(), vi.fn())
    expect(utterances[0].voice).toBe(samantha)
    service.stop()
  })
})
