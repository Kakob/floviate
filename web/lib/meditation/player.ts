import { BrowserAudioLayers, BrowserSpeechService, type AudioLayers, type PlaybackHandle, type SpeechService } from './audio'
import type { AmbientSettings, ComposedSession, TimelineEntry } from './types'

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error'

export interface PlayerState {
  status: PlayerStatus
  elapsedSeconds: number
  remainingSeconds: number
  currentEntry: TimelineEntry | null
  error: string | null
  timingDriftSeconds: number
}

export function createInitialPlayerState(session: ComposedSession): PlayerState {
  return { status: 'idle', elapsedSeconds: 0, remainingSeconds: session.totalDurationSeconds, currentEntry: null, error: null, timingDriftSeconds: 0 }
}

/** Injectable browser boundaries keep clock/transport behavior testable without a sound device. */
export interface PlayerDependencies {
  audio: AudioLayers
  speech: SpeechService
  now: () => number
  setTicker: (callback: () => void) => ReturnType<typeof setInterval>
  clearTicker: (ticker: ReturnType<typeof setInterval>) => void
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> | null
}

export class MeditationPlayer {
  private readonly dependencies: PlayerDependencies
  private state: PlayerState
  private index = -1
  private activeSinceMs = 0
  private accumulatedMs = 0
  private entryStartSeconds = 0
  private spokenEndSeconds = 0
  private speechDone = true
  private usingBrowserSpeech = false
  private pendingAmbientRecovery = false
  private playback: PlaybackHandle | null = null
  private pendingSpeech: (() => void) | null = null
  private ticker: ReturnType<typeof setInterval> | null = null
  private generation = 0
  private drift = 0
  private destroyed = false
  private pumping = false
  private ambient: AmbientSettings
  private characterIds: string[]

  constructor(private readonly session: ComposedSession, private readonly onChange: (state: PlayerState) => void, dependencies?: Partial<PlayerDependencies>) {
    this.state = createInitialPlayerState(session)
    this.ambient = session.config.ambient
    this.characterIds = ['narrator', ...new Set(session.timeline.flatMap(entry => entry.characterId && entry.characterId !== 'narrator' ? [entry.characterId] : []))]
    this.dependencies = {
      audio: dependencies?.audio || new BrowserAudioLayers(),
      speech: dependencies?.speech || new BrowserSpeechService(),
      now: dependencies?.now || (() => performance.now()),
      setTicker: dependencies?.setTicker || (callback => setInterval(callback, 100)),
      clearTicker: dependencies?.clearTicker || (ticker => clearInterval(ticker)),
      document: dependencies?.document === undefined ? (typeof document === 'undefined' ? null : document) : dependencies.document,
    }
    this.dependencies.audio.setErrorHandler?.(message => this.failAudio(message))
    this.dependencies.speech.setSentenceEndHandler?.(() => {
      if (this.destroyed || this.state.status !== 'playing') return
      if (this.pendingAmbientRecovery) {
        this.pendingAmbientRecovery = false
        this.restoreAmbient()
      } else this.dependencies.audio.afterSpeech?.()
    })
    this.dependencies.document?.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  getState(): PlayerState { return { ...this.state } }

  /** Call directly in the click/tap handler to retain Safari's user activation. */
  start() {
    if (this.destroyed || this.state.status === 'playing') return
    if (this.state.status === 'paused') { this.resume(); return }
    this.releasePlayback()
    this.index = -1
    this.accumulatedMs = 0
    this.entryStartSeconds = 0
    this.drift = 0
    this.state = { ...createInitialPlayerState(this.session), status: 'playing' }
    this.activeSinceMs = this.dependencies.now()
    try {
      this.dependencies.audio.setAmbient(this.ambient)
      this.dependencies.audio.unlock()
    } catch {
      this.failAudio('Audio could not start. Press Restart, or turn off background sounds and try again.')
    }
    if (this.state.status !== 'playing') return
    const firstSpokenEntry = this.session.timeline.find(entry => entry.type !== 'silent-hold' && entry.text.trim())
    if (firstSpokenEntry && (this.session.timeline[0] !== firstSpokenEntry || (firstSpokenEntry.audio && firstSpokenEntry.audio.scriptVersion === firstSpokenEntry.scriptVersion))) {
      this.dependencies.speech.unlock?.()
    }
    this.ticker = this.dependencies.setTicker(() => this.pump())
    this.beginEntry(0, 0)
    this.pump()
  }

  pause() {
    if (this.destroyed || this.state.status !== 'playing') return
    this.accumulatedMs = this.elapsed() * 1000
    this.state.status = 'paused'
    this.pendingAmbientRecovery = false
    this.clearTicker()
    this.playback?.pause()
    this.dependencies.audio.pause()
    this.publish()
  }

  resume() {
    if (this.destroyed || this.state.status !== 'paused') return
    this.activeSinceMs = this.dependencies.now()
    this.state.status = 'playing'
    this.state.error = null
    try { this.dependencies.audio.resume() } catch { this.failAudio('Audio could not resume. Press Restart to try again.') }
    if (this.state.status !== 'playing') return
    if (this.pendingSpeech) {
      const speak = this.pendingSpeech
      this.pendingSpeech = null
      speak()
    } else {
      this.playback?.resume()
    }
    // A native resume can synchronously report that iOS discarded its queue.
    if (this.state.status !== 'playing') return
    this.ticker = this.dependencies.setTicker(() => this.pump())
    this.pump()
  }

  restart() {
    if (this.destroyed) return
    this.stop()
    this.start()
  }

  stop() {
    if (this.destroyed) return
    this.accumulatedMs = this.elapsed() * 1000
    this.state.status = 'stopped'
    this.releasePlayback()
    this.state.currentEntry = null
    this.publish()
  }

  setAmbient(settings: AmbientSettings) {
    this.ambient = settings
    this.dependencies.audio.setAmbient(settings)
  }

  recoverAmbient() {
    if (this.destroyed || this.state.status !== 'playing') return
    // Changing the system audio mode during native speech can interrupt the
    // sentence on affected Safari versions. Honor the tap at the next gap.
    if (this.usingBrowserSpeech && !this.speechDone) {
      this.pendingAmbientRecovery = true
      return
    }
    this.restoreAmbient()
  }

  private restoreAmbient() {
    if (this.dependencies.audio.recover) this.dependencies.audio.recover()
    else this.dependencies.audio.resume()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.dependencies.document?.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.releasePlayback()
    this.dependencies.audio.destroy()
  }

  private onVisibilityChange = () => {
    if (this.dependencies.document?.visibilityState === 'hidden' && this.state.status === 'playing') {
      this.pause()
      this.state.error = 'Paused while this page was in the background. Return here and press Resume.'
      this.publish()
    }
  }

  private failAudio(message: string) {
    if (this.destroyed || (this.state.status !== 'playing' && this.state.status !== 'paused')) return
    this.accumulatedMs = this.elapsed() * 1000
    this.state.status = 'error'
    this.state.error = message
    this.releasePlayback()
    this.publish()
  }

  private elapsed() {
    return (this.accumulatedMs + (this.state.status === 'playing' ? Math.max(0, this.dependencies.now() - this.activeSinceMs) : 0)) / 1000
  }

  private beginEntry(index: number, startSeconds: number) {
    const generation = ++this.generation
    this.playback?.stop()
    this.playback = null
    this.pendingSpeech = null
    this.usingBrowserSpeech = false
    this.index = index
    this.entryStartSeconds = startSeconds
    this.spokenEndSeconds = startSeconds
    const entry = this.session.timeline[index]
    this.state.currentEntry = entry || null
    if (!entry) { this.complete(); return }
    this.speechDone = entry.type === 'silent-hold' || !entry.text.trim()
    if (this.speechDone) return
    const isCurrent = () => !this.destroyed && generation === this.generation && (this.state.status === 'playing' || this.state.status === 'paused')
    const ended = () => {
      if (!isCurrent()) return
      this.speechDone = true
      this.spokenEndSeconds = this.elapsed()
      this.pump()
    }
    const failed = (message: string) => {
      if (!isCurrent()) return
      this.accumulatedMs = this.elapsed() * 1000
      this.state.status = 'error'
      this.state.error = message
      this.releasePlayback()
      this.publish()
    }
    const speak = () => {
      if (!isCurrent()) return
      this.usingBrowserSpeech = true
      const characterId = entry.characterId || 'narrator'
      this.playback = this.dependencies.speech.speak(entry, this.session.config.voiceAssignments?.[characterId], Math.max(0, this.characterIds.indexOf(characterId)), ended, failed)
      if (this.state.status === 'paused') this.playback.pause()
    }
    // Stale recordings never override an edited script. A missing/unreadable recording falls back to that script.
    if (entry.audio && entry.audio.scriptVersion === entry.scriptVersion) {
      this.playback = this.dependencies.audio.playRecording(entry.audio, ended, () => {
        if (!isCurrent()) return
        this.playback?.stop()
        this.playback = null
        if (this.state.status === 'paused') this.pendingSpeech = speak
        else speak()
      })
    } else {
      speak()
    }
  }

  private pump() {
    if (this.destroyed || this.state.status !== 'playing' || this.pumping) return
    this.pumping = true
    try {
      let entry = this.session.timeline[this.index]
      while (entry && this.speechDone && this.state.status === 'playing') {
        const endSeconds = Math.max(this.entryStartSeconds + entry.durationSeconds, this.spokenEndSeconds)
        if (this.elapsed() + 0.00001 < endSeconds) break
        this.drift += Math.max(0, this.spokenEndSeconds - (this.entryStartSeconds + entry.durationSeconds))
        this.beginEntry(this.index + 1, endSeconds)
        entry = this.session.timeline[this.index]
      }
      if (this.state.status === 'playing') this.publish()
    } finally {
      this.pumping = false
    }
  }

  private complete() {
    this.accumulatedMs = (this.session.totalDurationSeconds + this.drift) * 1000
    this.state.status = 'completed'
    this.state.currentEntry = null
    this.releasePlayback()
    this.publish()
  }

  private publish() {
    if (this.destroyed) return
    const elapsedSeconds = this.elapsed()
    const entry = this.state.currentEntry
    const liveOverrun = entry && !this.speechDone ? Math.max(0, elapsedSeconds - this.entryStartSeconds - entry.durationSeconds) : 0
    const timingDriftSeconds = this.drift + liveOverrun
    this.state = {
      ...this.state,
      elapsedSeconds,
      timingDriftSeconds,
      remainingSeconds: this.state.status === 'completed' ? 0 : Math.max(0, this.session.totalDurationSeconds + timingDriftSeconds - elapsedSeconds),
    }
    this.onChange({ ...this.state })
  }

  private clearTicker() {
    if (this.ticker !== null) this.dependencies.clearTicker(this.ticker)
    this.ticker = null
  }

  private releasePlayback() {
    this.generation++
    this.clearTicker()
    this.playback?.stop()
    this.playback = null
    this.pendingSpeech = null
    this.pendingAmbientRecovery = false
    this.usingBrowserSpeech = false
    this.dependencies.speech.stop()
    this.dependencies.audio.stop()
  }
}
