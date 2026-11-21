import type { SessionConfig } from './types'

export const DURATION_PRESETS = [10, 30, 60, 180, 300, 600, 900] as const

export const DEFAULT_CONFIG: SessionConfig = {
  meditationId: 'i-got-it',
  durationSeconds: 180,
  focus: 'full',
  narration: true,
  dialogue: true,
  ambient: {
    brownNoise: { enabled: true, volume: 0.75 },
    rain: { enabled: true, volume: 0.75 },
  },
}
