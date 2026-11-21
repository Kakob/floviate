import Link from 'next/link'
import { Waves, ArrowUpRight } from 'lucide-react'
import './meditation.css'

export function PublicShell({ children, active = 'library', quiet = false }: { children: React.ReactNode; active?: 'library' | 'resources' | 'custom'; quiet?: boolean }) {
  return <div className="meditation-app">
    <header className="med-header">
      <Link className="med-brand" href="/" aria-label="Floviate home"><Waves size={25} strokeWidth={1.5} />floviate<span className="med-brand-dot">.</span></Link>
      <nav aria-label="Main navigation" className="med-nav">
        <Link href="/" aria-current={active === 'library' ? 'page' : undefined}>Library</Link>
        {!quiet && <Link href="/resources" aria-current={active === 'resources' ? 'page' : undefined}>Resources</Link>}
        {!quiet && <Link className="med-custom-link" href="/custom" aria-current={active === 'custom' ? 'page' : undefined}>Make it personal <ArrowUpRight size={14} /></Link>}
      </nav>
    </header>
    <main className="med-main">{children}</main>
    {!quiet && <footer className="med-footer"><Link href="/" className="med-brand">floviate.</Link><span>A little imagination. A feeling to take with you.</span><span>Made for your everyday.</span></footer>}
  </div>
}

export function MeditationArtwork({ accent, compact = false }: { accent: string; compact?: boolean }) {
  return <div className={`med-art med-art-${accent} ${compact ? 'med-art-compact' : ''}`} aria-hidden="true">
    <div className="med-art-orbit" /><div className="med-art-sun" /><div className="med-art-hill med-art-hill-back" /><div className="med-art-hill" />
    <span className="med-art-caption">A MOMENT, REIMAGINED</span>
  </div>
}
