import { estimateSpeechSeconds, PERSONALIZATION_TEMPLATES } from './content'
import { DIALOGUE_TURN_PAUSE_SECONDS } from './speech-pacing'
import type { ComposedSession, MeditationDefinition, MeditationPhase, MeditationUnit, SessionConfig, ScriptVariant, TimelineEntry, VariantLength } from './types'

const PHASES: MeditationPhase[] = ['arrival', 'intention', 'past', 'present', 'future', 'feeling', 'action', 'return']
const FOCUSES = ['full', 'past', 'present', 'future', 'feeling']

type Part = Omit<TimelineEntry, 'id' | 'startSeconds'>
interface Group {
  unit: MeditationUnit
  parts: Part[]
  durationMs: number
  sourceOrder: number
  priority: number
}

function milliseconds(seconds: number): number { return Math.round(seconds * 1000) }

/** Stable serialization also makes object property insertion order irrelevant. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

function hash(text: string): string {
  let value = 2166136261
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619)
  return (value >>> 0).toString(36)
}

function validate(meditation: MeditationDefinition, config: SessionConfig): void {
  if (!Number.isInteger(config.durationSeconds) || config.durationSeconds < 10 || config.durationSeconds > 900) {
    throw new RangeError('Choose a whole-number duration between 10 and 900 seconds.')
  }
  if (!FOCUSES.includes(config.focus)) throw new Error('Choose a valid meditation focus.')
  if (config.meditationId !== meditation.id) throw new Error('The selected meditation and configuration must match.')
  if (meditation.status !== 'published') throw new Error('This meditation is not available yet.')
  for (const layer of [config.ambient.brownNoise, config.ambient.rain]) {
    if (!Number.isFinite(layer.volume) || layer.volume < 0 || layer.volume > 1) throw new RangeError('Ambient volume must be between 0 and 1.')
  }
}

function allowedPhases(config: SessionConfig): MeditationPhase[] {
  if (config.durationSeconds < 60) return [config.focus === 'full' ? 'feeling' : config.focus]
  const focusPhases: MeditationPhase[] = config.focus === 'full'
    ? config.durationSeconds < 180 ? ['past', 'feeling'] : ['past', 'present', 'future', 'feeling']
    : config.focus === 'feeling' ? ['feeling'] : [config.focus, 'feeling']
  return [...(config.durationSeconds >= 300 ? ['arrival', 'intention'] as MeditationPhase[] : []), ...focusPhases, 'action', 'return']
}

function variantFor(duration: number): VariantLength {
  if (duration < 60) return duration <= 15 ? 'short' : 'medium'
  return duration <= 90 ? 'short' : duration <= 300 ? 'medium' : 'long'
}

function speechBudgetMs(durationSeconds: number): number {
  const fraction = durationSeconds < 60 ? 0.9 : durationSeconds <= 180 ? 0.86 : durationSeconds <= 300 ? 0.78 : durationSeconds <= 600 ? 0.7 : 0.6
  return Math.floor(milliseconds(durationSeconds) * fraction)
}

function scriptDurationSeconds(script: ScriptVariant, version: string): number {
  const audio = script.audio
  return audio && audio.scriptVersion === version && audio.src.trim() && Number.isFinite(audio.durationSeconds) && audio.durationSeconds > 0
    ? audio.durationSeconds : script.estimatedDurationSeconds
}

function fittingScript(unit: MeditationUnit, config: SessionConfig): ScriptVariant {
  const preferred = unit.variants?.[variantFor(config.durationSeconds)] ?? unit
  const availableMs = speechBudgetMs(config.durationSeconds) - milliseconds(unit.transition.beforeSeconds + unit.transition.afterSeconds)
  if (milliseconds(scriptDurationSeconds(preferred, unit.scriptVersion)) <= availableMs) return preferred
  // Duration bands are preferences, not a reason to return silence when a complete
  // shorter authored line fits. Never truncate text or change the speaking rate.
  const alternatives = [unit, ...Object.values(unit.variants ?? {})]
    .filter(script => milliseconds(scriptDurationSeconds(script, unit.scriptVersion)) <= availableMs)
    .sort((a, b) => scriptDurationSeconds(b, unit.scriptVersion) - scriptDurationSeconds(a, unit.scriptVersion))
  return alternatives[0] ?? preferred
}

function silencePart(unitId: string, phase: MeditationPhase, durationSeconds: number): Part {
  return { unitId, type: 'silent-hold', phase, durationSeconds, text: '', scriptVersion: '1' }
}

function groupFor(meditation: MeditationDefinition, unit: MeditationUnit, config: SessionConfig, sourceOrder: number, warnings: Set<string>, personalizedPhases: Set<MeditationPhase>): Group | undefined {
  const parts: Part[] = []
  const addSpeech = (part: Part) => {
    if (Number.isFinite(part.durationSeconds) && part.durationSeconds > 0) parts.push({ ...part, durationSeconds: milliseconds(part.durationSeconds) / 1000 })
  }
  const before = unit.transition.beforeSeconds
  if (before > 0) parts.push(silencePart(`${unit.id}-before`, unit.phase, before))

  if (unit.type === 'cinematic-dialogue') {
    const scene = meditation.scenes.find(candidate => candidate.id === unit.sceneId)
    if (!scene?.turns.length) {
      warnings.add(`Scene ${unit.sceneId ?? unit.id} has no dialogue and was skipped.`)
      return undefined
    }
    // A scene is a single selection group: either every ordered turn fits, or none do.
    scene.turns.forEach((turn, index) => {
      const audio = turn.audio && turn.audio.scriptVersion === turn.scriptVersion && turn.audio.src.trim() && Number.isFinite(turn.audio.durationSeconds) && turn.audio.durationSeconds > 0 ? turn.audio : undefined
      if (turn.audio && !audio) warnings.add(`Outdated or invalid recording for ${turn.id}; using browser speech.`)
      addSpeech({ unitId: unit.id, type: unit.type, phase: unit.phase, text: turn.text, characterId: turn.characterId, sceneId: scene.id, scriptVersion: turn.scriptVersion, audio, durationSeconds: audio?.durationSeconds ?? turn.estimatedDurationSeconds })
      if (index < scene.turns.length - 1) parts.push(silencePart(`${unit.id}-turn-${index + 1}-pause`, unit.phase, DIALOGUE_TURN_PAUSE_SECONDS))
    })
  } else if (unit.type === 'silent-hold') {
    parts.push(silencePart(unit.id, unit.phase, unit.estimatedDurationSeconds))
  } else {
    const selected = fittingScript(unit, config)
    let text = selected.text
    let personalized = false
    let anchor: string | undefined
    if (unit.phase === 'intention') anchor = config.intention
    else if (unit.type === 'visualization-prompt' || unit.type === 'emotional-recall') {
      anchor = config.anchors?.[unit.phase as keyof NonNullable<SessionConfig['anchors']>]
    }
    if (config.durationSeconds >= 60 && anchor?.trim() && unit.phase in PERSONALIZATION_TEMPLATES && !personalizedPhases.has(unit.phase)) {
      const personalText = PERSONALIZATION_TEMPLATES[unit.phase as keyof typeof PERSONALIZATION_TEMPLATES].replace('{anchor}', anchor.trim().slice(0, 240))
      const personalDurationMs = milliseconds(estimateSpeechSeconds(personalText, unit.type) + unit.transition.beforeSeconds + unit.transition.afterSeconds)
      if (personalDurationMs <= speechBudgetMs(config.durationSeconds)) {
        text = personalText
        personalized = true
        personalizedPhases.add(unit.phase)
      } else {
        warnings.add(`Your ${unit.phase} anchor needs a longer session. Using the complete guided prompt for this duration.`)
      }
    }
    const audio = !personalized && selected.audio && selected.audio.scriptVersion === unit.scriptVersion && selected.audio.src.trim() && Number.isFinite(selected.audio.durationSeconds) && selected.audio.durationSeconds > 0 ? selected.audio : undefined
    if (selected.audio && !audio) warnings.add(`Outdated or personalized recording for ${unit.id}; using browser speech.`)
    addSpeech({ unitId: unit.id, type: unit.type, phase: unit.phase, text, characterId: unit.characterId ?? 'narrator', scriptVersion: personalized ? `${unit.scriptVersion}-personalized` : unit.scriptVersion, audio, durationSeconds: audio?.durationSeconds ?? (personalized ? estimateSpeechSeconds(text, unit.type) : selected.estimatedDurationSeconds) })
  }
  if (unit.transition.afterSeconds > 0) parts.push(silencePart(`${unit.id}-after`, unit.phase, unit.transition.afterSeconds))
  return { unit, parts, sourceOrder, priority: 3, durationMs: parts.reduce((sum, part) => sum + milliseconds(part.durationSeconds), 0) }
}

function quietWeight(group: Group): number {
  if (group.unit.type === 'closing' || group.unit.phase === 'return') return 0
  if (group.unit.type === 'cinematic-dialogue') return 0.5
  if (group.unit.phase === 'feeling') return 4
  if (['past', 'present', 'future'].includes(group.unit.phase)) return 2.5
  if (group.unit.phase === 'action') return 1
  return 1.25
}

/** Pure deterministic planner. Spoken units and complete dialogue scenes are never
 * shortened to make a budget. Browser speech can run longer than an estimate; the
 * player keeps the words complete and reports the real elapsed session time. */
export function composeSession(meditation: MeditationDefinition, config: SessionConfig): ComposedSession {
  validate(meditation, config)
  const warnings = new Set<string>()
  const phases = allowedPhases(config)
  const targetMs = milliseconds(config.durationSeconds)
  const sessionId = `session-${hash(`${meditation.id}:${meditation.contentVersion}:${canonical(config)}`)}`
  const groups: Group[] = []
  const personalizedPhases = new Set<MeditationPhase>()
  meditation.units.forEach((unit, sourceOrder) => {
    if (config.durationSeconds < unit.minSessionSeconds || config.durationSeconds > unit.maxSessionSeconds || !phases.includes(unit.phase)) return
    if (unit.type === 'cinematic-dialogue' ? !config.dialogue : unit.type !== 'silent-hold' && !config.narration) return
    // A short narrated full journey uses one dramatic exchange, leaving time for
    // the listener’s own scenes. Focused journeys choose a scene in that focus.
    if (unit.type === 'cinematic-dialogue' && config.durationSeconds <= 180 && config.focus === 'full' && config.narration && groups.some(group => group.unit.type === 'cinematic-dialogue')) return
    const group = groupFor(meditation, unit, config, sourceOrder, warnings, personalizedPhases)
    if (group) groups.push(group)
  })

  const primaryPhases = new Set<MeditationPhase>()
  let firstScene = false
  groups.forEach(group => {
    if (group.unit.type === 'cinematic-dialogue') {
      group.priority = firstScene ? 4 : 1
      firstScene = true
    } else if (!primaryPhases.has(group.unit.phase)) {
      group.priority = group.unit.phase === 'return' ? 0 : 1
      primaryPhases.add(group.unit.phase)
    }
  })
  // Leave usable quiet space even when the content library grows substantially.
  const budgetMs = speechBudgetMs(config.durationSeconds)
  let selectedMs = 0
  const selected: Group[] = []
  const ranked = [...groups].sort((a, b) => a.priority - b.priority || a.sourceOrder - b.sourceOrder)
  for (const group of ranked) {
    if (selectedMs + group.durationMs <= budgetMs) {
      selected.push(group)
      selectedMs += group.durationMs
    }
  }
  selected.sort((a, b) => PHASES.indexOf(a.unit.phase) - PHASES.indexOf(b.unit.phase) || a.sourceOrder - b.sourceOrder)

  const timeline: TimelineEntry[] = []
  let cursorMs = 0
  const append = (part: Part) => {
    const durationMs = milliseconds(part.durationSeconds)
    if (durationMs <= 0) return
    timeline.push({ ...part, id: `${sessionId}-${timeline.length + 1}`, startSeconds: cursorMs / 1000, durationSeconds: durationMs / 1000 })
    cursorMs += durationMs
  }
  if (!selected.length) {
    append(silencePart('session-quiet', config.focus === 'full' ? 'feeling' : config.focus, targetMs / 1000))
  } else {
    const quietMs = targetMs - selectedMs
    const weight = selected.reduce((sum, group) => sum + quietWeight(group), 0)
    let allocatedQuiet = 0
    const lastQuietIndex = selected.map(group => quietWeight(group) > 0).lastIndexOf(true)
    selected.forEach((group, index) => {
      group.parts.forEach(append)
      const groupWeight = quietWeight(group)
      if (groupWeight > 0 && weight > 0) {
        const durationMs = index === lastQuietIndex ? quietMs - allocatedQuiet : Math.floor(quietMs * groupWeight / weight)
        append(silencePart(`${group.unit.id}-reflection`, group.unit.phase, durationMs / 1000))
        allocatedQuiet += durationMs
      }
    })
    // A closing-only collection still receives a quiet lead-in, not truncated speech.
    if (cursorMs < targetMs) append(silencePart('session-settle', 'feeling', (targetMs - cursorMs) / 1000))
  }
  if (!config.narration && config.dialogue && !timeline.some(entry => entry.type === 'cinematic-dialogue')) {
    warnings.add('No complete cinematic scene is available for this duration and focus. This session is a quiet practice with your chosen background sounds.')
  }
  const hasEstimatedSpeech = timeline.some(entry => entry.type !== 'silent-hold' && !entry.audio)
  if (hasEstimatedSpeech) warnings.add('Browser speech timing is estimated. Complete spoken lines take priority; slower voices may extend the session slightly.')
  return {
    id: sessionId, meditationId: meditation.id, title: meditation.title,
    contentVersion: meditation.contentVersion, config: JSON.parse(JSON.stringify(config)) as SessionConfig,
    timeline, totalDurationSeconds: targetMs / 1000, timing: hasEstimatedSpeech ? 'estimated' : 'measured', warnings: [...warnings],
  }
}
