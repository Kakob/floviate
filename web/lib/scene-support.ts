// Extension point for supported mode: adaptive music and narration.
// Adapters receive explicit user commands only. Logging a check-in never reaches this module:
// recording what happened and asking for help stay separate actions.

export type SupportMode = 'silence' | 'music' | 'narration' | 'both'

export interface SupportRequest {
  /** The day block being accompanied, or null for unplanned time. */
  blockId: string | null
  mode: SupportMode
  /** A plain-language instruction, e.g. "help me start" or "don't interrupt". */
  instruction: string
}

export interface SceneSupportAdapter {
  readonly available: boolean
  request(command: SupportRequest): Promise<void>
  stopNarration(): void
  stop(): void
}

/** Default adapter: silence is a feature. */
export const silentAdapter: SceneSupportAdapter = {
  available: false,
  request: async () => {},
  stopNarration: () => {},
  stop: () => {},
}
