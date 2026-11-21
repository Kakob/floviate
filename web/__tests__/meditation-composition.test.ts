import { describe, expect, it } from 'vitest'
import { composeSession } from '@/lib/meditation/compose'
import { estimateSpeechSeconds, getMeditation, MEDITATIONS } from '@/lib/meditation/content'
import { DEFAULT_CONFIG, DURATION_PRESETS } from '@/lib/meditation/defaults'
import { DIALOGUE_TURN_PAUSE_SECONDS, sentencePauseSeconds, SPEECH_SPEED_FACTOR, speechRate, splitSpeechSentences } from '@/lib/meditation/speech-pacing'
import type { MeditationDefinition, MeditationFocus, SessionConfig } from '@/lib/meditation/types'

const gotIt = getMeditation('i-got-it')!
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const configure = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({ ...clone(DEFAULT_CONFIG), ...overrides })
const focuses: MeditationFocus[] = ['full', 'past', 'present', 'future', 'feeling']

function assertTimeline(meditation: MeditationDefinition, config: SessionConfig) {
  const session = composeSession(meditation, config)
  let end = 0
  for (const entry of session.timeline) {
    expect(entry.startSeconds).toBeCloseTo(end, 6)
    expect(entry.durationSeconds).toBeGreaterThan(0)
    end += entry.durationSeconds
  }
  expect(end).toBeCloseTo(config.durationSeconds, 6)
  expect(session.totalDurationSeconds).toBe(config.durationSeconds)
  expect(new Set(session.timeline.map(entry => entry.id)).size).toBe(session.timeline.length)
  for (const scene of meditation.scenes) {
    const entries = session.timeline.filter(entry => entry.sceneId === scene.id)
    if (entries.length) {
      expect(entries.map(entry => entry.text)).toEqual(scene.turns.map(turn => turn.text))
      expect(entries.map(entry => entry.characterId)).toEqual(scene.turns.map(turn => turn.characterId))
    }
  }
  return session
}

describe('meditation composition', () => {
  it('plans the same slower rates and complete sentence gaps used by playback', () => {
    expect(SPEECH_SPEED_FACTOR).toBe(0.85)
    expect(speechRate('narration')).toBeCloseTo(0.87 * 0.85)
    expect(speechRate('cinematic-dialogue')).toBeCloseTo(0.94 * 0.85)
    expect(sentencePauseSeconds('narration')).toBe(1.2)
    expect(sentencePauseSeconds('cinematic-dialogue')).toBe(0.75)
    const text = 'Remember a moment. Feel it again. I got it.'
    const oldEstimate = text.split(/\s+/).length * 0.5 + 3 * 0.22
    expect(estimateSpeechSeconds(text, 'narration')).toBeCloseTo(oldEstimate / 0.85 + 2 * 1.2, 2)
    expect(estimateSpeechSeconds(text, 'cinematic-dialogue')).toBeCloseTo(oldEstimate / 0.85 + 2 * 0.75, 2)
  })

  it.each([
    ['Remember this. Feel it again!', ['Remember this.', 'Feel it again!']],
    ['“I got it!” Then she smiled.', ['“I got it!”', 'Then she smiled.']],
    ['Wait... Really? Yes… I got it.', ['Wait...', 'Really?', 'Yes…', 'I got it.']],
    ['Dr. Lee gave me 3.5 minutes. I rested.', ['Dr. Lee gave me 3.5 minutes.', 'I rested.']],
    ['Choose one detail, e.g. a quiet room. Stay there.', ['Choose one detail, e.g. a quiet room.', 'Stay there.']],
    ['At 5 p.m. Imagine returning home.', ['At 5 p.m.', 'Imagine returning home.']],
    ['J. Smith called from the U.S. today. Good news!', ['J. Smith called from the U.S. today.', 'Good news!']],
    ['  One complete line without punctuation  ', ['One complete line without punctuation']],
    ['', []],
  ])('splits complete sentences while preserving their words: %s', (text, expected) => {
    expect(splitSpeechSentences(text as string)).toEqual(expected)
  })

  it('budgets dialogue sentence pauses and the complete gap between every turn', () => {
    const scene = gotIt.scenes.find(item => item.id === 'got-it-dinner')!
    for (const turn of scene.turns) expect(turn.estimatedDurationSeconds).toBe(estimateSpeechSeconds(turn.text, 'cinematic-dialogue'))
    const session = composeSession(gotIt, configure())
    const pauses = session.timeline.filter(entry => /^got-it-dinner-scene-turn-\d-pause$/.test(entry.unitId))
    expect(pauses).toHaveLength(scene.turns.length - 1)
    expect(pauses.every(entry => entry.type === 'silent-hold' && entry.durationSeconds === DIALOGUE_TURN_PAUSE_SECONDS)).toBe(true)
  })

  it.each([0, 9, -1, 901, Infinity, NaN, 10.1, 899.5])('rejects invalid duration %s', durationSeconds => {
    expect(() => composeSession(gotIt, configure({ durationSeconds }))).toThrow(/between 10 and 900/)
  })

  it('speaks a complete focus-appropriate unit at every integer duration from 10 to 900 seconds', () => {
    const failures: string[] = []
    for (const meditation of MEDITATIONS.filter(item => item.status === 'published')) {
      for (let durationSeconds = 10; durationSeconds <= 900; durationSeconds++) {
        for (const focus of focuses) {
          const config = configure({ meditationId: meditation.id, durationSeconds, focus })
          const session = composeSession(meditation, config)
          const spoken = session.timeline.filter(entry => entry.type !== 'silent-hold')
          const primaryPhase = focus === 'full' ? durationSeconds < 60 ? 'feeling' : 'past' : focus
          if (!spoken.some(entry => entry.phase === primaryPhase && entry.type !== 'cinematic-dialogue')) failures.push(`${meditation.id}/${durationSeconds}/${focus}: no focus narration`)
          let end = 0
          for (const entry of session.timeline) {
            if (Math.abs(entry.startSeconds - end) > 0.000001 || entry.durationSeconds <= 0) failures.push(`${meditation.id}/${durationSeconds}/${focus}: invalid timeline`)
            end += entry.durationSeconds
          }
          if (Math.abs(end - durationSeconds) > 0.000001) failures.push(`${meditation.id}/${durationSeconds}/${focus}: wrong total`)
          for (const entry of spoken.filter(item => item.type !== 'cinematic-dialogue')) {
            const unit = meditation.units.find(item => item.id === entry.unitId)!
            if (![unit, ...Object.values(unit.variants ?? {})].some(script => script.text === entry.text)) failures.push(`${meditation.id}/${durationSeconds}/${focus}: incomplete script`)
          }
        }
      }
    }
    expect(failures).toEqual([])
  })

  it('falls back to a complete shorter recall at sixteen seconds instead of silent playback', () => {
    const session = composeSession(gotIt, configure({ durationSeconds: 16, focus: 'present' }))
    const spoken = session.timeline.filter(entry => entry.type !== 'silent-hold')
    expect(spoken).toHaveLength(1)
    expect(spoken[0].text).toBe(gotIt.units.find(unit => unit.id === 'got-it-recall-present')!.variants!.short!.text)
  })

  it('keeps focus guidance and explains when a personal anchor is too long to fit', () => {
    const session = composeSession(gotIt, configure({ durationSeconds: 60, focus: 'past', anchors: { past: 'a '.repeat(120) } }))
    expect(session.timeline.some(entry => entry.phase === 'past' && entry.type === 'visualization-prompt')).toBe(true)
    expect(session.warnings.join(' ')).toMatch(/anchor needs a longer session/)
  })

  it('explains why a dialogue-only recall is quiet', () => {
    const session = composeSession(gotIt, configure({ durationSeconds: 30, narration: false, dialogue: true }))
    expect(session.timeline.every(entry => entry.type === 'silent-hold')).toBe(true)
    expect(session.warnings.join(' ')).toMatch(/No complete cinematic scene/)
  })

  it('validates meditation, focus, and ambient volume', () => {
    expect(() => composeSession(gotIt, configure({ meditationId: 'other' }))).toThrow(/must match/)
    expect(() => composeSession(gotIt, configure({ focus: 'wrong' as MeditationFocus }))).toThrow(/valid meditation focus/)
    const config = configure()
    config.ambient.rain.volume = 1.1
    expect(() => composeSession(gotIt, config)).toThrow(/between 0 and 1/)
  })

  it('is deterministic, independent of config property order, and does not mutate inputs', () => {
    const meditation = clone(gotIt)
    const config = configure({ anchors: { past: 'Finishing my first painting.' }, intention: 'Make room for creativity.' })
    const before = JSON.stringify({ meditation, config })
    const first = composeSession(meditation, config)
    expect(composeSession(meditation, config)).toEqual(first)
    expect(composeSession(meditation, Object.fromEntries(Object.entries(config).reverse()) as unknown as SessionConfig)).toEqual(first)
    expect(JSON.stringify({ meditation, config })).toBe(before)
    expect(composeSession({ ...meditation, contentVersion: '1.0.1' }, config).id).not.toBe(first.id)
  })

  it('builds the complete three-minute I Got It demonstration with meaningful quiet', () => {
    const session = assertTimeline(gotIt, configure())
    const spoken = session.timeline.filter(entry => entry.type !== 'silent-hold')
    expect(spoken.map(entry => entry.unitId)).toEqual([
      'got-it-past',
      'got-it-dinner-scene', 'got-it-dinner-scene', 'got-it-dinner-scene', 'got-it-dinner-scene',
      'got-it-present', 'got-it-future', 'got-it-feeling', 'got-it-action', 'got-it-return',
    ])
    const quiet = session.timeline.filter(entry => entry.type === 'silent-hold')
    expect(quiet.reduce((total, entry) => total + entry.durationSeconds, 0)).toBeGreaterThan(35)
    expect(quiet.some(entry => entry.phase === 'present' && entry.durationSeconds >= 5)).toBe(true)
    expect(quiet.some(entry => entry.phase === 'feeling' && entry.durationSeconds >= 10)).toBe(true)
    expect(session.timing).toBe('estimated')
    expect(session.warnings.join(' ')).toMatch(/timing is estimated/)
  })

  it('keeps every supported duration, focus and layer combination contiguous and scenes complete', () => {
    for (const meditation of MEDITATIONS.filter(item => item.status === 'published')) {
      for (const durationSeconds of [...DURATION_PRESETS, 11, 45, 91, 179, 181, 301]) {
        for (const focus of focuses) {
          for (const [narration, dialogue] of [[true, true], [true, false], [false, true], [false, false]]) {
            const config = configure({ meditationId: meditation.id, durationSeconds, focus, narration, dialogue })
            const session = assertTimeline(meditation, config)
            if (!narration) expect(session.timeline.every(entry => entry.type === 'cinematic-dialogue' || entry.type === 'silent-hold')).toBe(true)
            if (!dialogue) expect(session.timeline.some(entry => entry.type === 'cinematic-dialogue')).toBe(false)
            if (!narration && !dialogue) expect(session.timeline).toHaveLength(1)
          }
        }
      }
    }
  })

  it.each(['past', 'present', 'future', 'feeling'] as const)('makes %s focus meaningful at short and long durations', focus => {
    for (const durationSeconds of [10, 30, 60, 180, 600, 900]) {
      const session = composeSession(gotIt, configure({ durationSeconds, focus }))
      const phases = session.timeline.map(entry => entry.phase)
      expect(phases).toContain(focus)
      for (const other of ['past', 'present', 'future']) if (focus !== other) expect(phases).not.toContain(other)
    }
  })

  it('selects a complete relevant scene when focusing on present or future', () => {
    for (const [focus, sceneId] of [['present', 'got-it-first-customer'], ['future', 'got-it-offer']] as const) {
      const session = composeSession(gotIt, configure({ focus }))
      const entries = session.timeline.filter(entry => entry.sceneId === sceneId)
      expect(entries.map(entry => entry.text)).toEqual(gotIt.scenes.find(scene => scene.id === sceneId)!.turns.map(turn => turn.text))
    }
  })

  it('keeps a short recall playable when a long personal anchor is saved', () => {
    const session = composeSession(gotIt, configure({ durationSeconds: 10, anchors: { feeling: 'A long and detailed personal memory that belongs in a longer practice.' } }))
    expect(session.timeline.some(entry => entry.type === 'emotional-recall')).toBe(true)
  })

  it('does not repeat the personal feeling template in longer sessions', () => {
    const session = composeSession(gotIt, configure({ durationSeconds: 600, anchors: { feeling: 'Creative confidence' } }))
    expect(session.timeline.filter(entry => entry.text.includes('Creative confidence'))).toHaveLength(1)
  })

  it('uses a dedicated recall prompt for ten seconds and does not cut a long paragraph', () => {
    const session = composeSession(gotIt, configure({ durationSeconds: 10 }))
    const spoken = session.timeline.filter(entry => entry.type !== 'silent-hold')
    expect(spoken).toHaveLength(1)
    const source = gotIt.units.find(unit => unit.id === spoken[0].unitId)!
    expect(spoken[0].text).toBe(source.variants?.short?.text)
    expect(spoken[0].durationSeconds).toBe(source.variants?.short?.estimatedDurationSeconds)
    expect(spoken[0].text).toMatch(/I got it\./)
  })

  it('uses each authored unit at most once, with complete text, during long journeys', () => {
    for (const durationSeconds of [300, 600, 900]) {
      const session = composeSession(gotIt, configure({ durationSeconds }))
      const narration = session.timeline.filter(entry => entry.type !== 'silent-hold' && entry.type !== 'cinematic-dialogue')
      expect(new Set(narration.map(entry => entry.unitId)).size).toBe(narration.length)
      for (const entry of narration) {
        const unit = gotIt.units.find(item => item.id === entry.unitId)!
        const expected = unit.variants?.[durationSeconds > 300 ? 'long' : 'medium'] ?? unit
        expect(entry.text).toBe(expected.text)
        expect(entry.durationSeconds).toBe(expected.estimatedDurationSeconds)
      }
    }
  })

  it('falls back to speech for missing or stale recordings, and respects measured current clips', () => {
    const meditation = clone(gotIt)
    const past = meditation.units.find(unit => unit.id === 'got-it-past')!
    const firstTurn = meditation.scenes[0].turns[0]
    expect(composeSession(meditation, configure()).timeline.find(entry => entry.unitId === past.id)?.audio).toBeUndefined()
    past.audio = { src: '/audio/past.mp3', durationSeconds: 17, scriptVersion: 'old' }
    firstTurn.audio = { src: '/audio/dinner-1.mp3', durationSeconds: 3, scriptVersion: 'old' }
    const stale = composeSession(meditation, configure())
    expect(stale.timeline.find(entry => entry.unitId === past.id)?.audio).toBeUndefined()
    expect(stale.timeline.find(entry => entry.sceneId === 'got-it-dinner')?.audio).toBeUndefined()
    expect(stale.warnings.join(' ')).toMatch(/Outdated/)
    past.audio.scriptVersion = past.scriptVersion
    firstTurn.audio.scriptVersion = firstTurn.scriptVersion
    const current = composeSession(meditation, configure())
    expect(current.timeline.find(entry => entry.unitId === past.id)?.durationSeconds).toBe(17)
    expect(current.timeline.find(entry => entry.unitId === past.id)?.audio?.src).toBe('/audio/past.mp3')
    expect(current.timeline.find(entry => entry.sceneId === 'got-it-dinner')?.durationSeconds).toBe(3)
  })

  it('never applies a base recording to a different duration variant', () => {
    const meditation = clone(gotIt)
    const past = meditation.units.find(unit => unit.id === 'got-it-past')!
    past.audio = { src: '/audio/base-past.mp3', durationSeconds: 17, scriptVersion: past.scriptVersion }
    const entry = composeSession(meditation, configure({ durationSeconds: 60 })).timeline.find(item => item.unitId === past.id)!
    expect(entry.text).toBe(past.variants?.short?.text)
    expect(entry.audio).toBeUndefined()
  })

  it('uses editable personalization templates and invalidates prerecorded personalized speech', () => {
    const meditation = clone(gotIt)
    const past = meditation.units.find(unit => unit.id === 'got-it-past')!
    past.audio = { src: '/audio/past.mp3', durationSeconds: 17, scriptVersion: past.scriptVersion }
    const entry = composeSession(meditation, configure({ anchors: { past: 'Teaching my friend to cook.' } })).timeline.find(item => item.unitId === past.id)!
    expect(entry.text).toContain('Teaching my friend to cook.')
    expect(entry.audio).toBeUndefined()
    expect(entry.scriptVersion).toContain('personalized')
  })

  it('keeps Lucky as identifiable draft content, unavailable for playback', () => {
    const lucky = getMeditation('i-am-lucky')!
    expect(lucky.status).toBe('draft')
    expect(lucky.catchphrase).toBe('I am lucky.')
    expect(lucky.units.length).toBeGreaterThan(0)
    expect(() => composeSession(lucky, configure({ meditationId: lucky.id }))).toThrow(/not available yet/)
  })
})
