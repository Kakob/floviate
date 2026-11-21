import type { SessionConfig } from './types'

const KEY = 'floviate.meditation.config.v1.'

export function readSavedConfig(meditationId: string): SessionConfig | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY + meditationId) || 'null')
    if (!value || value.meditationId !== meditationId || !Number.isInteger(value.durationSeconds) || value.durationSeconds < 10 || value.durationSeconds > 900 || !['full', 'past', 'present', 'future', 'feeling'].includes(value.focus) || typeof value.narration !== 'boolean' || typeof value.dialogue !== 'boolean') return null
    for (const key of ['brownNoise', 'rain']) {
      const layer = value.ambient?.[key]
      if (!layer || typeof layer.enabled !== 'boolean' || !Number.isFinite(layer.volume) || layer.volume < 0 || layer.volume > 1) return null
    }
    const clean: SessionConfig = { meditationId, durationSeconds: value.durationSeconds, focus: value.focus, narration: value.narration, dialogue: value.dialogue, ambient: value.ambient }
    if (typeof value.intention === 'string') clean.intention = value.intention.slice(0, 180)
    clean.anchors = {}
    for (const key of ['past', 'present', 'future', 'feeling'] as const) if (typeof value.anchors?.[key] === 'string') clean.anchors[key] = value.anchors[key].slice(0, 180)
    if (value.voiceAssignments && typeof value.voiceAssignments === 'object') clean.voiceAssignments = Object.fromEntries(Object.entries(value.voiceAssignments).filter(([, v]) => typeof v === 'string')) as Record<string, string>
    return clean
  } catch { return null }
}

export function saveConfig(config: SessionConfig): boolean {
  try { localStorage.setItem(KEY + config.meditationId, JSON.stringify(config)); return true } catch { return false }
}
