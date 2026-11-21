import type { AmbientSettings, AudioAsset, TimelineEntry } from './types'
import { sentencePauseSeconds, speechRate, splitSpeechSentences } from './speech-pacing'

export interface PlaybackHandle {
  pause(): void
  resume(): void
  stop(): void
}

export interface AudioLayers {
  setErrorHandler?(handler: (message: string) => void): void
  recover?(): void
  afterSpeech?(): void
  unlock(): void
  setAmbient(settings: AmbientSettings): void
  pause(): void
  resume(): void
  playRecording(asset: AudioAsset, onEnded: () => void, onError: (message: string) => void): PlaybackHandle
  stop(): void
  destroy(): void
}

export interface SpeechService {
  setSentenceEndHandler?(handler: () => void): void
  unlock?(): void
  speak(entry: TimelineEntry, voiceName: string | undefined, characterIndex: number, onEnded: () => void, onError: (message: string) => void): PlaybackHandle
  stop(): void
}

const volume = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const silentAmbient: AmbientSettings = {
  brownNoise: { enabled: false, volume: 0.25 },
  rain: { enabled: false, volume: 0.3 },
}

type ContextConstructor = new (options?: AudioContextOptions) => AudioContext
// Audio Session is supported by current iOS Safari but is not in every browser
// or TypeScript DOM release. Keep this enhancement optional.
type BrowserAudioSession = { type: string }

/** Locally synthesized ambience and decoded recordings share one unlocked audio context. */
export class BrowserAudioLayers implements AudioLayers {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private beds: { source: AudioBufferSourceNode; gain: GainNode }[] = []
  private recordings = new Map<PlaybackHandle, (message: string) => void>()
  private settings = silentAmbient
  private running = false
  private destroyed = false
  private unavailable: string | null = null
  private onError: ((message: string) => void) | null = null
  private audioSessionLease: { session: BrowserAudioSession; previousType: string } | null = null
  private attemptedContextRecovery = false
  private sessionRecoveryTimer: ReturnType<typeof setTimeout> | null = null
  private cyclingSession: BrowserAudioSession | null = null

  setErrorHandler(handler: (message: string) => void) { this.onError = handler }

  private wantsAmbient() { return this.settings.brownNoise.enabled || this.settings.rain.enabled }

  private selectPlaybackAudioSession() {
    if (this.audioSessionLease || typeof navigator === 'undefined') return
    try {
      const session = (navigator as Navigator & { audioSession?: BrowserAudioSession }).audioSession
      if (!session) return
      const previousType = session.type
      // iOS otherwise treats generated sound as "ambient" and silences it with
      // the ring/silent switch, even when the separate speech engine is audible.
      // Set this synchronously in the Play gesture, before creating the context.
      session.type = 'playback'
      this.audioSessionLease = { session, previousType }
    } catch { /* Experimental API; ordinary Web Audio still works without it. */ }
  }

  private restoreAudioSession() {
    const lease = this.audioSessionLease
    this.audioSessionLease = null
    try {
      // Do not overwrite a different audio mode selected by another owner.
      if (lease?.session.type === 'playback') lease.session.type = lease.previousType
    } catch { /* The browser may have withdrawn Audio Session access. */ }
  }

  private cancelSessionRecovery() {
    if (this.sessionRecoveryTimer !== null) clearTimeout(this.sessionRecoveryTimer)
    this.sessionRecoveryTimer = null
    const session = this.cyclingSession
    this.cyclingSession = null
    try {
      if (session?.type === 'ambient') session.type = 'playback'
    } catch { /* Audio Session access is optional. */ }
  }

  /** An explicit user retry also handles Safari reporting "running" while its
   * system output is silent. A real category change across tasks reasserts the
   * playback route; setting the same cached value again does not do that.
   * https://bugs.webkit.org/show_bug.cgi?id=323104 */
  recover() {
    if (this.destroyed || !this.running) return
    this.cancelSessionRecovery()
    const context = this.context
    if (!context) { this.unlock(); return }
    this.selectPlaybackAudioSession()
    const session = this.audioSessionLease?.session
    try {
      if (!session || session.type !== 'playback') { this.resumeContext(); return }
      session.type = 'ambient'
      this.cyclingSession = session
      this.sessionRecoveryTimer = setTimeout(() => {
        this.sessionRecoveryTimer = null
        if (this.destroyed || !this.running || this.context !== context || this.cyclingSession !== session) return
        this.cyclingSession = null
        try {
          if (session.type === 'ambient') session.type = 'playback'
        } catch { /* Continue with ordinary context recovery where available. */ }
        this.resumeContext()
      }, 0)
    } catch {
      this.cyclingSession = null
      this.resumeContext()
    }
  }

  /** Native speech may suspend Web Audio on iOS. Retry after it actually ends,
   * when speech is no longer competing for the system route. Never cycle audio
   * categories automatically or repeatedly resume against an active sentence. */
  afterSpeech() {
    if (this.destroyed || !this.running || !this.context || this.cyclingSession) return
    if (['suspended', 'interrupted'].includes(this.context.state)) {
      this.attemptedContextRecovery = false
      this.resumeContext()
    }
  }

  private onContextStateChange = () => {
    const context = this.context
    if (!context || !this.running || this.cyclingSession) return
    if (context.state === 'running') {
      this.attemptedContextRecovery = false
      return
    }
    // Safari additionally exposes "interrupted" (e.g. a system audio event).
    // Try once per interruption; explicit Resume or a sound control retries
    // within a fresh user gesture if the browser requires one.
    if (['suspended', 'interrupted'].includes(context.state) && !this.attemptedContextRecovery) {
      this.attemptedContextRecovery = true
      this.resumeContext()
    }
  }

  private audioUnavailable(message: string) {
    const wantedRunning = this.running
    const recordingErrors = [...this.recordings.values()]
    this.stop()
    this.running = wantedRunning
    this.unavailable = message
    if (this.wantsAmbient()) this.onError?.(message)
    else recordingErrors.forEach(fallback => fallback(message))
  }

  unlock() {
    if (this.destroyed || typeof window === 'undefined') return
    this.running = true
    this.unavailable = null
    this.selectPlaybackAudioSession()
    if (!this.context) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: ContextConstructor }).webkitAudioContext
      // Speech still works when a browser does not provide Web Audio.
      if (!AudioContextClass) {
        this.audioUnavailable('Background sound is unavailable in this browser. Turn off brown noise and rain to continue with narration.')
        return
      }
      try {
        this.context = new AudioContextClass()
        this.attemptedContextRecovery = false
        this.context.addEventListener('statechange', this.onContextStateChange)
        this.master = this.context.createGain()
        this.master.gain.value = 0.7
        this.master.connect(this.context.destination)
      } catch {
        this.audioUnavailable('Background audio could not start. Press Restart, or turn off background sounds and try again.')
        return
      }
    }
    this.resumeContext()
    if (this.context) this.ensureBeds()
  }

  private resumeContext() {
    const context = this.context
    if (!context || context.state === 'closed') return
    // Call from the Play/Resume gesture before any promise or network work.
    try {
      void context.resume().catch(() => {
        if (this.context === context && this.running) this.audioUnavailable('Your browser blocked background audio. Press Restart to allow audio, or turn off background sounds.')
      })
    } catch {
      if (this.context === context && this.running) this.audioUnavailable('Background audio could not resume. Press Restart, or turn off background sounds.')
    }
  }

  private ensureBeds() {
    const context = this.context
    if (!context || !this.master || this.beds.length || !this.running) return
    // No oscillators, downloads, third-party recordings, or paid services.
    for (const kind of ['brownNoise', 'rain'] as const) {
      const source = context.createBufferSource()
      source.buffer = this.noiseBuffer(context, kind)
      source.loop = true
      const gain = context.createGain()
      gain.gain.value = 0
      if (kind === 'rain') {
        const highpass = context.createBiquadFilter()
        highpass.type = 'highpass'
        highpass.frequency.value = 600
        const lowpass = context.createBiquadFilter()
        lowpass.type = 'lowpass'
        lowpass.frequency.value = 6500
        source.connect(highpass).connect(lowpass).connect(gain)
      } else {
        source.connect(gain)
      }
      gain.connect(this.master)
      source.start()
      this.beds.push({ source, gain })
    }
    this.applyGains()
  }

  private noiseBuffer(context: AudioContext, kind: 'brownNoise' | 'rain') {
    const length = Math.floor(context.sampleRate * 12)
    const overlap = Math.floor(context.sampleRate * 0.12)
    const buffer = context.createBuffer(2, length, context.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const raw = new Float32Array(length + overlap)
      let brown = 0
      let drop = 0
      for (let sample = 0; sample < raw.length; sample++) {
        const white = Math.random() * 2 - 1
        if (kind === 'brownNoise') {
          brown = (brown + 0.018 * white) / 1.018
          raw[sample] = brown * 3.6
        } else {
          // Continuous rainfall with soft, scattered droplets and slow variations.
          if (Math.random() < 0.00045) drop = 0.25 + Math.random() * 0.35
          drop *= 0.997
          const swell = 0.7 + 0.12 * Math.sin(sample / context.sampleRate * 0.83 + channel)
          raw[sample] = white * (swell * 0.4 + drop)
        }
      }
      const data = buffer.getChannelData(channel)
      data.set(raw.subarray(0, length))
      // Overlap-add makes the loop boundary continuous, including brown noise.
      for (let sample = 0; sample < overlap; sample++) {
        const mix = sample / overlap
        data[sample] = raw[sample] * mix + raw[length + sample] * (1 - mix)
      }
    }
    return buffer
  }

  setAmbient(settings: AmbientSettings) {
    this.settings = settings
    if (this.running && this.wantsAmbient() && this.unavailable) {
      this.audioUnavailable(this.unavailable)
      return
    }
    this.applyGains()
    if (this.running && this.wantsAmbient() && this.context?.state !== 'running') this.resumeContext()
  }

  private applyGains() {
    if (!this.context) return
    ;(['brownNoise', 'rain'] as const).forEach((key, index) => {
      const gain = this.beds[index]?.gain.gain
      if (!gain) return
      gain.cancelScheduledValues(this.context!.currentTime)
      gain.setTargetAtTime(this.settings[key].enabled ? volume(this.settings[key].volume) : 0, this.context!.currentTime, 0.08)
    })
  }

  pause() {
    this.running = false
    this.cancelSessionRecovery()
    const context = this.context
    if (context && context.state !== 'closed') {
      void context.suspend().then(() => {
        // A rapid Resume may have arrived while suspend was still pending.
        if (this.running && this.context === context) this.resumeContext()
      }).catch(() => {})
    }
  }

  resume() {
    this.unlock()
  }

  playRecording(asset: AudioAsset, onEnded: () => void, onError: (message: string) => void): PlaybackHandle {
    const context = this.context
    const controller = new AbortController()
    let buffer: AudioBuffer | null = null
    let source: AudioBufferSourceNode | null = null
    let offset = 0
    let startedAt = 0
    let stopped = false
    let paused = !this.running
    const disconnect = () => {
      if (!source) return
      source.onended = null
      try { source.stop() } catch { /* The buffer may have already finished. */ }
      source.disconnect()
      source = null
    }
    const start = () => {
      if (stopped || paused || !context || !buffer || !this.master || source) return
      if (offset >= buffer.duration) {
        stopped = true
        this.recordings.delete(handle)
        onEnded()
        return
      }
      source = context.createBufferSource()
      source.buffer = buffer
      source.connect(this.master)
      source.onended = () => {
        if (stopped || paused) return
        stopped = true
        source?.disconnect()
        source = null
        this.recordings.delete(handle)
        onEnded()
      }
      startedAt = context.currentTime
      source.start(0, offset)
    }
    const handle: PlaybackHandle = {
      pause: () => {
        if (stopped || paused) return
        paused = true
        if (source && context) offset += Math.max(0, context.currentTime - startedAt)
        disconnect()
      },
      resume: () => { if (!stopped) { paused = false; start() } },
      stop: () => {
        stopped = true
        controller.abort()
        disconnect()
        this.recordings.delete(handle)
      },
    }
    this.recordings.set(handle, onError)
    if (!context || this.unavailable) {
      // Defer the failure so the caller can retain the handle before falling back.
      queueMicrotask(() => { if (!stopped) onError('Recorded audio is unavailable in this browser.') })
      return handle
    }
    void fetch(asset.src, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Recording could not be loaded.')
        return response.arrayBuffer()
      })
      .then(bytes => context.decodeAudioData(bytes))
      .then(decoded => { if (!stopped) { buffer = decoded; start() } })
      .catch(() => { if (!stopped) onError('Recording could not be loaded. Using the editable script instead.') })
    return handle
  }

  stop() {
    this.running = false
    this.cancelSessionRecovery()
    for (const recording of [...this.recordings.keys()]) recording.stop()
    for (const bed of this.beds) {
      try { bed.source.stop() } catch { /* Already stopped. */ }
      bed.source.disconnect()
      bed.gain.disconnect()
    }
    this.beds = []
    this.master?.disconnect()
    this.master = null
    const context = this.context
    this.context = null
    if (context) {
      context.removeEventListener('statechange', this.onContextStateChange)
      if (context.state !== 'closed') void context.close().catch(() => {})
    }
    this.attemptedContextRecovery = false
    this.restoreAudioSession()
  }

  destroy() {
    this.destroyed = true
    this.stop()
  }
}

/** The browser owns speech timing; the player never cuts a spoken line to fit an estimate. */
export class BrowserSpeechService implements SpeechService {
  private active: PlaybackHandle | null = null
  private onSentenceEnd: (() => void) | null = null

  setSentenceEndHandler(handler: () => void) { this.onSentenceEnd = handler }

  /** Safari remembers the first speak() gesture, even for an empty utterance.
   * Prime only when the real opening line is delayed by silence or a recording. */
  unlock() {
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return
    const silent = new SpeechSynthesisUtterance('')
    silent.volume = 0
    window.speechSynthesis.speak(silent)
    window.speechSynthesis.cancel()
  }

  speak(entry: TimelineEntry, voiceName: string | undefined, characterIndex: number, onEnded: () => void, onError: (message: string) => void): PlaybackHandle {
    this.stop()
    let stopped = false
    let desiredPaused = false
    let utterance: SpeechSynthesisUtterance | null = null
    let sentenceIndex = 0
    let inGap = false
    let gapRemainingMs = 0
    let gapStartedAt = 0
    let gapTimer: ReturnType<typeof setTimeout> | null = null
    const sentences = splitSpeechSentences(entry.text)
    const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    const detachUtterance = () => {
      if (!utterance) return
      utterance.onend = null
      utterance.onerror = null
      utterance.onstart = null
      utterance.onpause = null
      utterance.onresume = null
      utterance = null
    }
    const clearGap = () => {
      if (gapTimer !== null) clearTimeout(gapTimer)
      gapTimer = null
    }
    const finish = (error?: string) => {
      if (stopped) return
      stopped = true
      clearGap()
      detachUtterance()
      if (this.active === handle) this.active = null
      if (error) {
        synthesis?.cancel()
        onError(error)
      } else onEnded()
    }
    const handle: PlaybackHandle = {
      pause: () => {
        if (stopped || desiredPaused) return
        desiredPaused = true
        if (inGap) {
          if (gapTimer !== null) gapRemainingMs = Math.max(0, gapRemainingMs - (performance.now() - gapStartedAt))
          clearGap()
        } else if (utterance) synthesis?.pause()
      },
      resume: () => {
        if (stopped || !desiredPaused) return
        desiredPaused = false
        if (inGap) {
          // An empty native speech queue is expected between sentences. Resume
          // the remaining silence without repeating or skipping either sentence.
          scheduleGap()
          return
        }
        // iOS may discard active speech while the page is suspended. This check
        // applies only to an in-flight sentence, never to our intentional gaps.
        if (utterance && synthesis?.speaking === false && synthesis.pending === false) {
          finish('Your browser released spoken audio while this page was away. Press Restart to begin again.')
          return
        }
        synthesis?.resume()
      },
      stop: () => {
        if (stopped) return
        stopped = true
        clearGap()
        detachUtterance()
        synthesis?.cancel()
        if (this.active === handle) this.active = null
      },
    }
    this.active = handle
    if (!synthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      queueMicrotask(() => finish('Spoken audio is not available in this browser. Try Safari, Chrome, or Edge with a system voice installed.'))
      return handle
    }
    const voices = synthesis.getVoices()
    const englishVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith('en'))
    const novelty = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Organ|Ralph|Trinoids|Whisper|Wobble|Zarvox)$/i
    const natural = englishVoices.filter(voice => !novelty.test(voice.name))
    const preferred = /Samantha|Alex|Daniel|Karen|Moira|Tessa|Ava|Serena|Google|Microsoft/i
    const english = (natural.length ? natural : englishVoices).sort((a, b) => Number(b.default) - Number(a.default) || Number(preferred.test(b.name)) - Number(preferred.test(a.name)) || Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name))
    const assigned = voices.find(voice => voice.name === voiceName || voice.voiceURI === voiceName)
    const selected = assigned || english[characterIndex % Math.max(1, english.length)] || voices.find(voice => voice.default)

    const scheduleGap = () => {
      if (stopped || desiredPaused || !inGap || gapTimer !== null) return
      gapStartedAt = performance.now()
      gapTimer = setTimeout(() => {
        gapTimer = null
        if (stopped || desiredPaused) return
        inGap = false
        gapRemainingMs = 0
        speakSentence()
      }, gapRemainingMs)
    }
    const speakSentence = () => {
      if (stopped || desiredPaused) return
      if (sentenceIndex >= sentences.length) { finish(); return }
      const current = new SpeechSynthesisUtterance(sentences[sentenceIndex])
      utterance = current
      const isCurrent = () => !stopped && utterance === current
      if (selected) current.voice = selected
      current.lang = selected?.lang || 'en-US'
      current.rate = speechRate(entry.type)
      current.pitch = entry.type === 'cinematic-dialogue' ? (characterIndex % 2 ? 1.03 : 0.96) : 1
      current.volume = 1
      current.onstart = () => { if (isCurrent() && desiredPaused) synthesis.pause() }
      // Apply the latest request if a native pause/resume acknowledgement is late.
      current.onpause = () => { if (isCurrent() && !desiredPaused) synthesis.resume() }
      current.onresume = () => { if (isCurrent() && desiredPaused) synthesis.pause() }
      current.onend = () => {
        if (!isCurrent()) return
        detachUtterance()
        sentenceIndex++
        this.onSentenceEnd?.()
        if (stopped) return
        if (sentenceIndex >= sentences.length) { finish(); return }
        inGap = true
        gapRemainingMs = sentencePauseSeconds(entry.type) * 1000
        scheduleGap()
      }
      current.onerror = event => {
        if (!isCurrent()) return
        finish(event.error === 'not-allowed'
          ? 'Your browser blocked spoken audio. Press Restart to allow audio, and keep this page open.'
          : 'The browser interrupted spoken audio. Press Restart to try again, and keep this page open.')
      }
      // First sentence starts directly in the Play gesture; subsequent sentences
      // wait for actual speech completion plus a pause. Ambience runs separately.
      try {
        synthesis.resume()
        synthesis.speak(current)
      } catch {
        finish('Spoken audio could not start. Press Restart to try again.')
      }
    }
    if (sentences.length) speakSentence()
    else queueMicrotask(() => finish())
    return handle
  }

  stop() {
    this.active?.stop()
    this.active = null
  }
}
