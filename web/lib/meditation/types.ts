export type MeditationPhase = 'arrival' | 'intention' | 'past' | 'present' | 'future' | 'feeling' | 'action' | 'return'
export type UnitType = 'narration' | 'cinematic-dialogue' | 'breathing-guidance' | 'visualization-prompt' | 'emotional-recall' | 'silent-hold' | 'transition' | 'inspired-action' | 'closing'
export type MeditationFocus = 'full' | 'past' | 'present' | 'future' | 'feeling'
export type VariantLength = 'short' | 'medium' | 'long'

export interface AudioAsset {
  src: string
  durationSeconds: number
  scriptVersion: string
}

export interface ScriptVariant {
  text: string
  estimatedDurationSeconds: number
  audio?: AudioAsset
}

export interface DialogueTurn extends ScriptVariant {
  id: string
  characterId: string
  scriptVersion: string
}

export interface CinematicScene {
  id: string
  title: string
  category: 'responsibility' | 'receiving' | 'both' | 'resilience'
  scriptVersion: string
  turns: DialogueTurn[]
}

export interface MeditationUnit {
  id: string
  type: UnitType
  phase: MeditationPhase
  emotionalEffect: string
  scriptVersion: string
  text: string
  characterId?: string
  sceneId?: string
  variants?: Partial<Record<VariantLength, ScriptVariant>>
  audio?: AudioAsset
  estimatedDurationSeconds: number
  minSessionSeconds: number
  maxSessionSeconds: number
  transition: { beforeSeconds: number; afterSeconds: number }
}

export interface MeditationDefinition {
  id: string
  title: string
  description: string
  theme: string
  catchphrase: string
  availability: 'free' | 'premium'
  status: 'published' | 'draft'
  contentVersion: string
  accent: 'amber' | 'sage' | 'lavender'
  units: MeditationUnit[]
  scenes: CinematicScene[]
}

export interface AmbientSettings {
  brownNoise: { enabled: boolean; volume: number }
  rain: { enabled: boolean; volume: number }
}

export interface SessionConfig {
  meditationId: string
  durationSeconds: number
  focus: MeditationFocus
  narration: boolean
  dialogue: boolean
  ambient: AmbientSettings
  intention?: string
  anchors?: { past?: string; present?: string; future?: string; feeling?: string }
  voiceAssignments?: Record<string, string>
}

export interface TimelineEntry {
  id: string
  unitId: string
  type: UnitType
  phase: MeditationPhase
  startSeconds: number
  durationSeconds: number
  text: string
  characterId?: string
  sceneId?: string
  audio?: AudioAsset
  scriptVersion: string
}

export interface ComposedSession {
  id: string
  meditationId: string
  title: string
  contentVersion: string
  config: SessionConfig
  timeline: TimelineEntry[]
  totalDurationSeconds: number
  timing: 'estimated' | 'measured'
  warnings: string[]
}

/** Future custom authoring input; it grants no billing or generation entitlement. */
export interface CustomMeditationBrief {
  title: string
  catchphrase: string
  intention: string
  pastMemory: string
  presentOpportunity: string
  futureVisualization: string
  desiredFeeling: string
  narrationStyle: 'gentle' | 'grounded' | 'cinematic'
  dialogueStyle: 'everyday' | 'celebratory' | 'reflective'
}
