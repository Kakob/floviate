'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Play, Save, Sparkles } from 'lucide-react'
import { composeSession } from '@/lib/meditation/compose'
import { DEFAULT_CONFIG, DURATION_PRESETS } from '@/lib/meditation/defaults'
import { MeditationPlayer, createInitialPlayerState } from '@/lib/meditation/player'
import type { PlayerState } from '@/lib/meditation/player'
import { readSavedConfig, saveConfig } from '@/lib/meditation/saved-config'
import type { ComposedSession, MeditationDefinition, MeditationFocus, SessionConfig } from '@/lib/meditation/types'
import { AmbientControls } from './ambient-controls'
import { MeditationArtwork, PublicShell } from './public-shell'
import { PlayerView } from './player-view'
import { useAmbientPreview } from './use-ambient-preview'

const FOCUSES: { value: MeditationFocus; title: string; description: string }[] = [
  { value: 'full', title: 'Full journey', description: 'Connect the moments' },
  { value: 'past', title: 'Remember', description: 'A feeling you know' },
  { value: 'present', title: 'Right now', description: 'Today’s possibility' },
  { value: 'future', title: 'Imagine', description: 'What could be' },
  { value: 'feeling', title: 'Just the feeling', description: 'Space to settle in' },
]
const phaseLabels: Record<string, string> = { arrival: 'Arrive', intention: 'Set an intention', past: 'Remember', present: 'Imagine today', future: 'Look ahead', feeling: 'Rest in the feeling', action: 'Take it with you', return: 'Return' }
export function durationLabel(seconds: number) { return seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} sec` : ''}` }

export function MeditationComposer({ meditation }: { meditation: MeditationDefinition }) {
  const [config, setConfig] = useState<SessionConfig>(() => ({ ...DEFAULT_CONFIG, meditationId: meditation.id }))
  const [session, setSession] = useState<ComposedSession | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [hasSaved, setHasSaved] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const playerRef = useRef<MeditationPlayer | null>(null)
  const ambientPreview = useAmbientPreview(config.ambient)
  const preview = useMemo(() => {
    try { return { session: composeSession(meditation, config), error: null } }
    catch (error) { return { session: null, error: error instanceof Error ? error.message : 'Please check your session settings.' } }
  }, [meditation, config])
  useEffect(() => {
    setHasSaved(!!readSavedConfig(meditation.id))
    const synth = window.speechSynthesis
    if (!synth) return
    const update = () => setVoices(synth.getVoices())
    update()
    synth.addEventListener('voiceschanged', update)
    return () => synth.removeEventListener('voiceschanged', update)
  }, [meditation.id])
  useEffect(() => () => { playerRef.current?.destroy() }, [])

  function start() {
    if (!preview.session) return
    ambientPreview.stop()
    playerRef.current?.destroy()
    const next = preview.session
    setSession(next)
    setPlayerState(createInitialPlayerState(next))
    const player = new MeditationPlayer(next, setPlayerState)
    playerRef.current = player
    player.start() // Stay inside the user gesture to unlock mobile audio.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function adjust() {
    playerRef.current?.destroy()
    playerRef.current = null
    setSession(null)
    setPlayerState(null)
  }
  function save() {
    const saved = saveConfig(config)
    setSaveMessage(saved ? 'Saved on this device.' : 'This browser could not save your settings.')
    setHasSaved(saved)
  }
  const phases = preview.session?.timeline.reduce<string[]>((result, entry) => result[result.length - 1] === entry.phase ? result : [...result, entry.phase], []) ?? []
  const characters = ['narrator', ...Array.from(new Set(meditation.scenes.flatMap(scene => scene.turns.map(turn => turn.characterId))))]

  if (session && playerState) return <PublicShell quiet={playerState.status !== 'completed'}><PlayerView meditation={meditation} session={session} state={playerState} ambient={config.ambient} onAmbient={ambient => { setConfig(value => ({ ...value, ambient })); playerRef.current?.setAmbient(ambient) }} onPause={() => playerRef.current?.pause()} onResume={() => playerRef.current?.resume()} onRestart={() => playerRef.current?.restart()} onStop={() => playerRef.current?.stop()} onRecoverAmbient={() => playerRef.current?.recoverAmbient()} onAdjust={adjust} /></PublicShell>

  return <PublicShell>
    <Link className="med-back" href="/"><ArrowLeft size={16} /> Back to the library</Link>
    <div className="med-composer-grid">
      <aside className="med-composer-intro">
        <MeditationArtwork accent={meditation.accent} compact />
        <div className="med-eyebrow">FREE GUIDED MEDITATION</div>
        <h1>{meditation.title}<span className="med-heading-period">.</span></h1>
        <p>{meditation.description}</p>
        <blockquote>“{meditation.catchphrase}”</blockquote>
        <div className="med-intro-note"><Sparkles size={18} /><p>A little guidance, a scene to imagine, and room to make it your own.</p></div>
        <Link href="/resources" className="med-text-link">Bring your practice onto the page <ArrowRight size={15} /></Link>
      </aside>
      <section className="med-composer-panel" aria-labelledby="composer-title">
        <div className="med-section-heading"><div><div className="med-eyebrow">YOUR MOMENT</div><h2 id="composer-title">Make room for yourself.</h2></div></div>
        {hasSaved && <button className="med-text-link med-load" onClick={() => { const saved = readSavedConfig(meditation.id); if (saved) { setConfig(saved); setSaveMessage('Your saved settings are ready.') } }}>Use my saved settings <ArrowRight size={14} /></button>}
        <fieldset className="med-fieldset"><legend>How much time do you have?</legend><div className="med-duration-grid">{DURATION_PRESETS.map(seconds => <button key={seconds} type="button" aria-pressed={config.durationSeconds === seconds} className={`med-choice ${config.durationSeconds === seconds ? 'is-selected' : ''}`} onClick={() => setConfig({ ...config, durationSeconds: seconds })}>{durationLabel(seconds)}{seconds === 180 && <span>Start here</span>}</button>)}</div>
          <details className="med-small-details"><summary>Choose an exact length</summary><label className="med-label">Seconds (10–900)<input className="med-input" type="number" min="10" max="900" step="1" value={Number.isNaN(config.durationSeconds) ? '' : config.durationSeconds} onChange={e => setConfig({ ...config, durationSeconds: e.target.value === '' ? NaN : Number(e.target.value) })} /></label></details>
        </fieldset>
        <fieldset className="med-fieldset"><legend>Where would you like to go?</legend><div className="med-focus-grid">{FOCUSES.map(focus => <button className={`med-focus-choice ${config.focus === focus.value ? 'is-selected' : ''}`} aria-pressed={config.focus === focus.value} key={focus.value} onClick={() => setConfig({ ...config, focus: focus.value })}><strong>{focus.title}</strong><span>{focus.description}</span></button>)}</div></fieldset>
        <fieldset className="med-fieldset"><legend>Your guidance</legend>
          <label className="med-toggle-row med-guidance"><span><strong>Narration</strong><small>A gentle guide for your imagination</small></span><input type="checkbox" checked={config.narration} onChange={e => setConfig({ ...config, narration: e.target.checked })} /></label>
          <label className="med-toggle-row med-guidance"><span><strong>Cinematic dialogue</strong><small>Little conversations that bring the feeling to life</small></span><input type="checkbox" checked={config.dialogue} onChange={e => setConfig({ ...config, dialogue: e.target.checked })} /></label>
          {config.durationSeconds < 60 && <p className="med-help">Short moments use a complete recall prompt. Scenes appear when there’s room for the whole conversation.</p>}
          {!config.narration && !config.dialogue && <p className="med-help">A quiet, timed space with your chosen background sounds.</p>}
        </fieldset>
        <fieldset className="med-fieldset"><legend>Set the atmosphere <span>Optional</span></legend><AmbientControls value={config.ambient} onChange={ambient => setConfig({ ...config, ambient })} />
          <div className="med-start-row"><button type="button" className="med-button med-secondary" disabled={!ambientPreview.testing && !ambientPreview.canTest} onClick={ambientPreview.testing ? ambientPreview.stop : ambientPreview.start}>{ambientPreview.testing ? 'Stop sound test' : 'Test background sounds'}</button>{ambientPreview.testing && <button type="button" className="med-button med-secondary" onClick={ambientPreview.recover}>Restore background sound</button>}</div>
          <p className="med-help" role="status">{ambientPreview.note || (ambientPreview.testing ? 'Listen for your selected sounds and adjust their volumes. If you hear nothing, check your phone’s media volume and try Restore background sound.' : ambientPreview.canTest ? 'Test rain and brown noise before starting, without narration. You can stop the test at any time.' : 'Enable rain or brown noise and raise its volume to test background sound.')}</p>
          {ambientPreview.error && <p className="med-error" role="alert">{ambientPreview.error}</p>}
        </fieldset>
        <details className="med-details"><summary>Make it personal <span>Intention & visualization anchors</span></summary><p className="med-help">A few words for your own experience. Longer sessions weave these into the guidance when there’s room. Nothing is uploaded to a Floviate account.</p>
          <label className="med-label">Your intention (sessions of 5 minutes or more)<input className="med-input" maxLength={180} placeholder="A project I’m ready to begin" value={config.intention ?? ''} onChange={e => setConfig({ ...config, intention: e.target.value })} /></label>
          {(['past', 'present', 'future', 'feeling'] as const).map(key => <label className="med-label" key={key}>{({ past: 'A past memory', present: 'A present opportunity', future: 'A future visualization', feeling: 'A feeling to return to' })[key]}<input className="med-input" maxLength={180} value={config.anchors?.[key] ?? ''} onChange={e => setConfig({ ...config, anchors: { ...config.anchors, [key]: e.target.value } })} /></label>)}
        </details>
        <details className="med-details"><summary>Choose your voices <span>Device voices</span></summary><p className="med-help">Voice quality and selection depend on your browser. Some device voices use an online speech service.</p>{characters.map(character => <label className="med-label" key={character}>{character.replace(/[-_]/g, ' ')}<select className="med-input" value={config.voiceAssignments?.[character] ?? ''} onChange={e => setConfig({ ...config, voiceAssignments: { ...config.voiceAssignments, [character]: e.target.value } })}><option value="">Choose automatically</option>{voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}</select></label>)}</details>
        <div className="med-session-preview"><div className="med-eyebrow">YOUR SESSION</div><p>{phases.map(phase => phaseLabels[phase]).join(' → ')}</p><span>{preview.session ? `${durationLabel(preview.session.totalDurationSeconds)} · ${config.narration || config.dialogue ? 'Guidance with space to feel' : 'Quiet practice'}` : 'Choose a duration from 10 to 900 seconds.'}</span></div>
        {preview.error && <p role="alert" className="med-error">{preview.error}</p>}
        {preview.session?.warnings.map((warning, index) => <p className="med-help" key={index}>{warning}</p>)}
        <div className="med-start-row"><button className="med-button med-primary" disabled={!preview.session} onClick={start}><Play size={17} fill="currentColor" /> Begin meditation</button><button className="med-icon-button" onClick={save} disabled={!preview.session} aria-label="Save settings on this device" title="Save settings on this device"><Save size={19} /></button></div>
        <p className="med-save-message" role="status">{saveMessage && <><Check size={14} /> {saveMessage}</>}</p>
        <p className="med-help">Keep this page open while listening. Switching apps pauses your session.</p>
      </section>
    </div>
  </PublicShell>
}
