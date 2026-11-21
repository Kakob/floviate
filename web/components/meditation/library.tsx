import Link from 'next/link'
import { ArrowRight, Play, Headphones, Sparkles, Clock3 } from 'lucide-react'
import { MEDITATIONS } from '@/lib/meditation/content'
import { PublicShell, MeditationArtwork } from './public-shell'

export function MeditationLibrary() {
  return <PublicShell>
    <section className="med-hero">
      <div className="med-eyebrow"><span /> GUIDED VISUALIZATION, YOUR WAY</div>
      <h1>Feel it here.<br /><em>Take it with you.</em></h1>
      <p>Revisit a moment. Imagine what’s possible. Find a feeling you can carry into the rest of your day.</p>
      <div className="med-hero-actions"><Link className="med-button med-primary" href="/meditations/i-got-it"><Play size={16} fill="currentColor" /> Try a three-minute meditation</Link><span>No account needed. Just a moment for you.</span></div>
      <div className="med-hero-decoration" aria-hidden="true"><div /><div /><div /><span>room to<br /><i>feel.</i></span></div>
    </section>
    <section id="library" aria-labelledby="library-title" className="med-library-section">
      <div className="med-section-heading"><div><div className="med-eyebrow">THE LIBRARY</div><h2 id="library-title">Where would you like to begin?</h2></div><span className="med-subtle"><Clock3 size={15} /> 10 seconds to 15 minutes</span></div>
      <div className="med-card-grid">{MEDITATIONS.map((meditation, index) => <article className="med-card" key={meditation.id}>
        <div className="med-card-art"><MeditationArtwork accent={meditation.accent} /><span className="med-tag">{meditation.status === 'draft' ? 'Coming soon' : 'Free meditation'}</span><span className="med-card-number">0{index + 1}</span></div>
        <div className="med-card-body"><div className="med-eyebrow">{meditation.theme}</div><h3>{meditation.title}</h3><p>{meditation.description}</p>
          {meditation.status === 'published' ? <Link className="med-card-action" href={`/meditations/${meditation.id}`}>Make this moment yours <ArrowRight size={18} /></Link> : <span className="med-card-action med-subtle">A little good fortune is on its way <Sparkles size={17} /></span>}
        </div>
      </article>)}</div>
    </section>
    <section className="med-method" aria-labelledby="method-title"><div><div className="med-eyebrow">MORE THAN WORDS TO REPEAT</div><h2 id="method-title">A small scene.<br />A real feeling.</h2><p>Guidance, little cinematic conversations, and space for your own imagination. Each session is put together around the time and focus you choose.</p><Link href="/resources" className="med-text-link">Explore the practice <ArrowRight size={16} /></Link></div><ol>
      <li><span>01</span><div><h3>Remember & imagine</h3><p>Connect a past experience to something possible today.</p></div></li>
      <li><span>02</span><div><h3>Let the feeling stay</h3><p>Let the words and images fade. Give yourself room to feel.</p></div></li>
      <li><span>03</span><div><h3>Carry it into your day</h3><p>Find one small action, then notice what the real experience feels like.</p></div></li>
    </ol></section>
    <section className="med-bottom-note"><Headphones size={20} /><p>Your pace. Your atmosphere. Listen with optional rain, warm brown noise, or a quiet background.</p></section>
  </PublicShell>
}
