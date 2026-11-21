import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserSpeechService } from '../lib/meditation/audio'
import type { TimelineEntry } from '../lib/meditation/types'

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'paced-line', unitId: 'paced-line', type: 'narration', phase: 'past',
    text: 'Remember a moment of capability. Give yourself room to feel it. I got it.',
    startSeconds: 0, durationSeconds: 20, scriptVersion: '1', ...overrides,
  }
}

function speechHarness(voices: SpeechSynthesisVoice[] = []) {
  const utterances: SpeechSynthesisUtterance[] = []
  const synthesis = {
    speaking: false, pending: false,
    speak: vi.fn<(utterance: SpeechSynthesisUtterance) => void>(),
    pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(), getVoices: () => voices,
  }
  synthesis.speak.mockImplementation(utterance => { synthesis.speaking = true; utterances.push(utterance) })
  synthesis.cancel.mockImplementation(() => { synthesis.speaking = false; synthesis.pending = false })
  vi.stubGlobal('speechSynthesis', synthesis)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  const finish = (utterance = utterances[utterances.length - 1]) => {
    synthesis.speaking = false
    synthesis.pending = false
    utterance.onend?.call(utterance, {} as SpeechSynthesisEvent)
  }
  const fail = (utterance = utterances[utterances.length - 1]) => {
    synthesis.speaking = false
    utterance.onerror?.call(utterance, { error: 'audio-hardware' } as SpeechSynthesisErrorEvent)
  }
  const service = new BrowserSpeechService()
  return { service, synthesis, utterances, finish, fail }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('slower speech and sentence spacing', () => {
  it('notifies background recovery after every actual sentence end, never a stale callback', () => {
    const { service, utterances, finish } = speechHarness()
    const sentenceEnded = vi.fn()
    const ended = vi.fn()
    service.setSentenceEndHandler(sentenceEnded)
    service.speak(entry({ text: 'Remember. I got it.' }), undefined, 0, ended, vi.fn())
    const first = utterances[0]
    const oldEnd = first.onend
    expect(sentenceEnded).not.toHaveBeenCalled()
    finish()
    expect(sentenceEnded).toHaveBeenCalledOnce()
    oldEnd?.call(first, {} as SpeechSynthesisEvent)
    expect(sentenceEnded).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1200)
    finish()
    expect(sentenceEnded).toHaveBeenCalledTimes(2)
    expect(ended).toHaveBeenCalledOnce()
    service.stop()
  })
  it.each([
    ['narration', 0.87 * 0.85],
    ['visualization-prompt', 0.87 * 0.85],
    ['cinematic-dialogue', 0.94 * 0.85],
  ] as const)('speaks %s fifteen percent slower than its original rate', (type, expectedRate) => {
    const { service, utterances } = speechHarness()
    service.speak(entry({ type, text: 'I got it.' }), undefined, 0, vi.fn(), vi.fn())
    expect(utterances).toHaveLength(1)
    expect(utterances[0].rate).toBeCloseTo(expectedRate, 6)
    service.stop()
  })

  it.each([
    ['narration', 1200],
    ['cinematic-dialogue', 750],
  ] as const)('plays whole %s sentences with a %i ms gap and completes only after the last sentence', (type, gapMs) => {
    const { service, utterances, finish } = speechHarness()
    const ended = vi.fn()
    const failed = vi.fn()
    service.speak(entry({ type }), undefined, 1, ended, failed)
    expect(utterances.map(utterance => utterance.text)).toEqual(['Remember a moment of capability.'])
    // A slow native voice must finish before the silence clock begins.
    vi.advanceTimersByTime(8000)
    expect(utterances).toHaveLength(1)
    finish()
    expect(ended).not.toHaveBeenCalled()
    vi.advanceTimersByTime(gapMs - 1)
    expect(utterances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(utterances.map(utterance => utterance.text)).toEqual(['Remember a moment of capability.', 'Give yourself room to feel it.'])
    finish()
    vi.advanceTimersByTime(gapMs)
    expect(utterances[2].text).toBe('I got it.')
    expect(ended).not.toHaveBeenCalled()
    finish()
    expect(ended).toHaveBeenCalledOnce()
    expect(failed).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    service.stop()
  })

  it('uses one character voice and speech style throughout a multi-sentence dialogue turn', () => {
    const voice = { name: 'Daniel', voiceURI: 'com.apple.voice.Daniel', lang: 'en-GB', localService: true, default: false } as SpeechSynthesisVoice
    const { service, utterances, finish } = speechHarness([voice])
    service.speak(entry({ type: 'cinematic-dialogue', text: 'You know what? I got it.' }), voice.voiceURI, 1, vi.fn(), vi.fn())
    finish()
    vi.advanceTimersByTime(750)
    expect(utterances).toHaveLength(2)
    for (const utterance of utterances) {
      expect(utterance.voice).toBe(voice)
      expect(utterance.lang).toBe('en-GB')
      expect(utterance.rate).toBeCloseTo(0.94 * 0.85, 6)
      expect(utterance.pitch).toBe(1.03)
    }
    service.stop()
  })
})

describe('sentence gaps follow meditation transport', () => {
  it('freezes the remaining sentence gap while paused and resumes without a discarded-queue error', () => {
    const { service, synthesis, utterances, finish } = speechHarness()
    const failed = vi.fn()
    const handle = service.speak(entry(), undefined, 0, vi.fn(), failed)
    finish()
    vi.advanceTimersByTime(400)
    handle.pause()
    expect(synthesis.speaking).toBe(false)
    expect(synthesis.pending).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(utterances).toHaveLength(1)
    handle.resume()
    expect(failed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(799)
    expect(utterances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(utterances).toHaveLength(2)
    expect(utterances[1].text).toBe('Give yourself room to feel it.')
    service.stop()
  })

  it('keeps the current native utterance on active-speech pause and resume', () => {
    const { service, synthesis, utterances, finish } = speechHarness()
    const failed = vi.fn()
    const handle = service.speak(entry(), undefined, 0, vi.fn(), failed)
    const first = utterances[0]
    const previousResumes = synthesis.resume.mock.calls.length
    handle.pause()
    expect(synthesis.pause).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(5000)
    handle.resume()
    expect(synthesis.resume).toHaveBeenCalledTimes(previousResumes + 1)
    expect(utterances).toEqual([first])
    expect(failed).not.toHaveBeenCalled()
    finish()
    vi.advanceTimersByTime(1200)
    expect(utterances).toHaveLength(2)
    service.stop()
  })

  it('does not start the next sentence if a native end acknowledgment arrives while paused', () => {
    const { service, utterances, finish } = speechHarness()
    const handle = service.speak(entry(), undefined, 0, vi.fn(), vi.fn())
    handle.pause()
    finish()
    vi.advanceTimersByTime(5000)
    expect(utterances).toHaveLength(1)
    handle.resume()
    vi.advanceTimersByTime(1199)
    expect(utterances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(utterances).toHaveLength(2)
    service.stop()
  })

  it('cancels the sentence gap on stop and ignores callbacks from the finished sentence', () => {
    const { service, utterances, finish } = speechHarness()
    const ended = vi.fn()
    const failed = vi.fn()
    const handle = service.speak(entry(), undefined, 0, ended, failed)
    const first = utterances[0]
    const oldEnd = first.onend
    const oldError = first.onerror
    finish()
    vi.advanceTimersByTime(250)
    handle.stop()
    expect(vi.getTimerCount()).toBe(0)
    oldEnd?.call(first, {} as SpeechSynthesisEvent)
    oldError?.call(first, { error: 'canceled' } as SpeechSynthesisErrorEvent)
    vi.advanceTimersByTime(5000)
    expect(utterances).toHaveLength(1)
    expect(ended).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
    service.stop()
  })

  it('replaces a unit during its gap without letting its stale callbacks affect the next unit', () => {
    const { service, utterances, finish } = speechHarness()
    const oldEnded = vi.fn()
    const oldFailed = vi.fn()
    service.speak(entry(), undefined, 0, oldEnded, oldFailed)
    const oldUtterance = utterances[0]
    const oldEnd = oldUtterance.onend
    const oldError = oldUtterance.onerror
    finish()
    vi.advanceTimersByTime(400)
    const newEnded = vi.fn()
    const newFailed = vi.fn()
    service.speak(entry({ id: 'next-unit', text: 'Bring this feeling with you.' }), undefined, 0, newEnded, newFailed)
    oldEnd?.call(oldUtterance, {} as SpeechSynthesisEvent)
    oldError?.call(oldUtterance, { error: 'canceled' } as SpeechSynthesisErrorEvent)
    vi.advanceTimersByTime(5000)
    expect(utterances.map(utterance => utterance.text)).toEqual(['Remember a moment of capability.', 'Bring this feeling with you.'])
    expect(oldEnded).not.toHaveBeenCalled()
    expect(oldFailed).not.toHaveBeenCalled()
    expect(newFailed).not.toHaveBeenCalled()
    finish()
    expect(newEnded).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    service.stop()
  })

  it('ignores a finished sentence’s late callbacks while later sentences in the same unit continue', () => {
    const { service, utterances, finish } = speechHarness()
    const ended = vi.fn()
    const failed = vi.fn()
    service.speak(entry(), undefined, 0, ended, failed)
    const first = utterances[0]
    const oldEnd = first.onend
    const oldError = first.onerror
    finish()
    oldError?.call(first, { error: 'interrupted' } as SpeechSynthesisErrorEvent)
    vi.advanceTimersByTime(1200)
    oldEnd?.call(first, {} as SpeechSynthesisEvent)
    oldError?.call(first, { error: 'interrupted' } as SpeechSynthesisErrorEvent)
    expect(utterances).toHaveLength(2)
    expect(ended).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
    finish()
    vi.advanceTimersByTime(1200)
    expect(utterances[2].text).toBe('I got it.')
    finish()
    expect(ended).toHaveBeenCalledOnce()
    service.stop()
  })

  it('cleans up after a later sentence fails and never schedules the remainder', () => {
    const { service, utterances, finish, fail } = speechHarness()
    const ended = vi.fn()
    const failed = vi.fn()
    service.speak(entry(), undefined, 0, ended, failed)
    finish()
    vi.advanceTimersByTime(1200)
    const second = utterances[1]
    expect(second).toBeDefined()
    const lateEnd = second.onend
    fail(second)
    lateEnd?.call(second, {} as SpeechSynthesisEvent)
    vi.advanceTimersByTime(10000)
    expect(failed).toHaveBeenCalledOnce()
    expect(ended).not.toHaveBeenCalled()
    expect(utterances).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(0)
    service.stop()
  })
})
