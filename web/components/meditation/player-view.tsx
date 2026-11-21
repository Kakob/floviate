'use client'

import Link from 'next/link'
import { ArrowLeft, Check, Pause, Play, RotateCcw, Square } from 'lucide-react'
import type { PlayerState } from '@/lib/meditation/player'
import type { AmbientSettings, ComposedSession, MeditationDefinition } from '@/lib/meditation/types'
import { AmbientControls } from './ambient-controls'
import { ResourceLinks } from './resource-links'

function clock(seconds: number, roundUp = false) { const n = Math.max(0, roundUp ? Math.ceil(seconds) : Math.floor(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` }
const phaseLabels: Record<string, string> = { arrival: 'Arriving', intention: 'Your intention', past: 'A moment you remember', present: 'A possibility today', future: 'Something to imagine', feeling: 'Rest in the feeling', action: 'Take it with you', return: 'Coming back' }

export function PlayerView({ meditation, session, state, ambient, onAmbient, onPause, onResume, onRestart, onStop, onRecoverAmbient, onAdjust }: {
  meditation: MeditationDefinition; session: ComposedSession; state: PlayerState; ambient: AmbientSettings;
  onAmbient: (ambient: AmbientSettings) => void; onPause: () => void; onResume: () => void; onRestart: () => void; onStop: () => void; onRecoverAmbient: () => void; onAdjust: () => void;
}) {
  const completed = state.status === 'completed'
  const playing = state.status === 'playing'
  const entry = state.currentEntry
  return <section className={`med-player ${playing ? 'is-playing' : ''}`} aria-labelledby="player-title">
    <button className="med-back" onClick={onAdjust}><ArrowLeft size={16} /> Adjust your meditation</button>
    <div className="med-player-heading"><div className="med-eyebrow">{completed ? 'A MOMENT, WELL SPENT' : 'YOUR GUIDED MEDITATION'}</div><h1 id="player-title">{completed ? 'Take the feeling with you.' : meditation.title}</h1><p>{completed ? 'One small step is enough to begin.' : 'Nothing to get right. Just a moment to be here.'}</p></div>
    <div className={`med-player-orb med-orb-${meditation.accent}`} aria-hidden="true"><div /><span>{completed ? <Check size={36} strokeWidth={1} /> : meditation.catchphrase}</span></div>
    <div className="med-caption" aria-live="polite" aria-atomic="true"><div className="med-eyebrow">{completed ? 'BACK TO YOUR DAY' : state.status === 'stopped' ? 'SESSION STOPPED' : entry ? phaseLabels[entry.phase] : 'SETTLE IN'}{state.status === 'paused' && ' · PAUSED'}</div>
      <p>{completed ? 'What is one thing you’d like to do next? Later, notice how the real experience compares with what you imagined.' : state.status === 'stopped' ? 'Your moment is here whenever you’re ready.' : entry?.text || 'Let the words fall away. There’s room to rest here.'}</p>
      {entry?.type === 'cinematic-dialogue' && !completed && <span className="med-speaker">{entry.characterId?.replace(/[-_]/g, ' ')}</span>}
    </div>
    {!completed && <>
      <div className="med-progress-block"><progress max={session.totalDurationSeconds + state.timingDriftSeconds} value={state.elapsedSeconds} aria-label="Meditation progress" /><div><span>{clock(state.elapsedSeconds)} elapsed</span><span>{clock(state.remainingSeconds, true)} remaining{state.timingDriftSeconds > 1 ? ' · adjusted for speech' : ''}</span></div></div>
      {state.error && <p className="med-error" role="alert">{state.error}</p>}
      <div className="med-player-controls"><button className="med-icon-button" aria-label="Restart meditation" onClick={onRestart}><RotateCcw size={21} /></button><button className="med-play-button" aria-label={playing ? 'Pause meditation' : state.status === 'paused' ? 'Resume meditation' : 'Play meditation'} onClick={playing ? onPause : state.status === 'paused' ? onResume : onRestart}>{playing ? <Pause size={27} fill="currentColor" /> : <Play size={27} fill="currentColor" />}</button><button className="med-icon-button" aria-label="Stop meditation" onClick={onStop}><Square size={20} /></button></div>
      <div className="med-player-atmosphere"><h2>Your atmosphere</h2><AmbientControls value={ambient} onChange={onAmbient} /><button type="button" className="med-button med-secondary" disabled={!playing} onClick={onRecoverAmbient}>Restore background sound</button><p className="med-help">{state.status === 'paused' ? 'Resume the meditation before restoring background sound.' : 'If you cannot hear the selected sounds, check your media volume. Restore retries background sound after any current sentence.'} Keep this page in the foreground; switching apps pauses the session.</p></div>
      <details className="med-details med-transcript"><summary>Session transcript</summary><ol>{session.timeline.filter(item => item.text && item.type !== 'silent-hold').map(item => <li className={entry?.id === item.id ? 'is-current' : ''} key={item.id}><span>{clock(item.startSeconds)} · {item.characterId?.replace(/[-_]/g, ' ') || phaseLabels[item.phase]}</span><p>{item.text}</p></li>)}</ol></details>
    </>}
    {completed && <div className="med-completion"><div className="med-completion-buttons"><button className="med-button med-primary" onClick={onRestart}><RotateCcw size={16} /> Listen again</button><Link href="/" className="med-button med-secondary">Back to the library</Link></div><div className="med-completion-resources"><h2>Give the feeling somewhere to go.</h2><p>Explore the worksheet, or begin shaping a practice around your own experiences.</p><ResourceLinks compact /></div></div>}
  </section>
}
