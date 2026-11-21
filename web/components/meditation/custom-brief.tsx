'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Save } from 'lucide-react'
import type { CustomMeditationBrief } from '@/lib/meditation/types'
import { PublicShell } from './public-shell'
import { RESOURCES } from '@/lib/meditation/resources'

const EMPTY: CustomMeditationBrief = { title: '', catchphrase: '', intention: '', pastMemory: '', presentOpportunity: '', futureVisualization: '', desiredFeeling: '', narrationStyle: 'gentle', dialogueStyle: 'everyday' }
const fields: { key: keyof Omit<CustomMeditationBrief, 'narrationStyle' | 'dialogueStyle'>; title: string; placeholder: string }[] = [
  { key: 'title', title: 'A title for your practice', placeholder: 'My next chapter' },
  { key: 'catchphrase', title: 'Your catchphrase', placeholder: 'I’m ready.' },
  { key: 'intention', title: 'A desire or intention', placeholder: 'What would you like to experience?' },
  { key: 'pastMemory', title: 'A memory', placeholder: 'A time you felt capable, grateful, or hopeful' },
  { key: 'presentOpportunity', title: 'Something available today', placeholder: 'A small opportunity to begin, create, or connect' },
  { key: 'futureVisualization', title: 'A future scene', placeholder: 'Where are you? Who is there? What happens?' },
  { key: 'desiredFeeling', title: 'The feeling you want to carry', placeholder: 'Relief. Excitement. Quiet confidence.' },
]
const STORAGE_KEY = 'floviate.custom-brief.v1'
export function CustomBrief() {
  const [brief, setBrief] = useState<CustomMeditationBrief>(EMPTY)
  const [message, setMessage] = useState('')
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (!saved || typeof saved !== 'object') return
      const clean = { ...EMPTY }
      for (const field of fields) if (typeof saved[field.key] === 'string') clean[field.key] = saved[field.key].slice(0, 500)
      if (['gentle', 'grounded', 'cinematic'].includes(saved.narrationStyle)) clean.narrationStyle = saved.narrationStyle
      if (['everyday', 'celebratory', 'reflective'].includes(saved.dialogueStyle)) clean.dialogueStyle = saved.dialogueStyle
      setBrief(clean)
    } catch { /* Private browsing may disable storage. The form still works. */ }
  }, [])
  const waitlist = RESOURCES.find(resource => resource.id === 'newsletter')
  return <PublicShell active="custom"><div className="med-custom-grid"><section className="med-page-intro"><div className="med-eyebrow">A PRACTICE THAT’S YOURS</div><h1>Your story.<br /><em>Your feeling.</em></h1><p>Begin with the moments that matter to you. Gather them here as a creative brief for your own meditation.</p><div className="med-custom-notice"><span className="med-status-pill">Custom audio coming later</span><p>You can save a brief on this device today. Custom meditation generation and subscriptions are not available yet.</p></div><Link className="med-text-link" href="/meditations/i-got-it">Try your own memories in a free meditation <ArrowRight size={16} /></Link>{waitlist?.href && <Link className="med-text-link" href={waitlist.href}>Join the waitlist <ArrowRight size={16} /></Link>}</section><form className="med-composer-panel" onSubmit={event => { event.preventDefault(); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(brief)); setMessage('Your brief is saved on this device. No account or purchase is needed.') } catch { setMessage('This browser could not save your brief. You can copy your words before leaving.') } }}><h2>Start with a few words.</h2>{fields.map(field => <label className="med-label" key={field.key}>{field.title}<textarea className="med-input" rows={field.key === 'title' || field.key === 'catchphrase' ? 1 : 2} maxLength={500} placeholder={field.placeholder} value={brief[field.key]} onChange={event => setBrief({ ...brief, [field.key]: event.target.value })} /></label>)}<div className="med-ambient-grid"><label className="med-label">Narration style<select className="med-input" value={brief.narrationStyle} onChange={event => setBrief({ ...brief, narrationStyle: event.target.value as CustomMeditationBrief['narrationStyle'] })}><option value="gentle">Gentle</option><option value="grounded">Grounded</option><option value="cinematic">Cinematic</option></select></label><label className="med-label">Dialogue style<select className="med-input" value={brief.dialogueStyle} onChange={event => setBrief({ ...brief, dialogueStyle: event.target.value as CustomMeditationBrief['dialogueStyle'] })}><option value="everyday">Everyday</option><option value="celebratory">Celebratory</option><option value="reflective">Reflective</option></select></label></div><button className="med-button med-primary" type="submit"><Save size={17} /> Save my creative brief</button><p className="med-help" role="status">{message || 'Saved only in this browser. Clearing browser data removes your brief.'}</p></form></div></PublicShell>
}
