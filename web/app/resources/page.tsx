import type { Metadata } from 'next'
import { PublicShell } from '@/components/meditation/public-shell'
import { ResourceLinks } from '@/components/meditation/resource-links'

export const metadata: Metadata = { title: 'Resources · Floviate', description: 'Take your visualization practice into everyday life with Floviate videos, worksheets, and reflective exercises.' }
export default function ResourcesPage() {
  return <PublicShell active="resources"><section className="med-page-intro"><div className="med-eyebrow">BEYOND THE MEDITATION</div><h1>Make a little room<br /><em>in your everyday.</em></h1><p>Explore the ideas behind the practice. Put a feeling into words. Find one small thing to do next.</p></section><ResourceLinks /><section className="med-reflection"><div className="med-eyebrow">A PRACTICE YOU CAN TRY RIGHT NOW</div><h2>From imagination to a small action.</h2><ol><li>What do you want to experience, and how might it feel?</li><li>When have you felt something like that before?</li><li>What opportunity is available to you today?</li><li>Imagine a future moment. Compare its feeling with your memory.</li><li>Let the picture fade. Stay with the feeling for a moment.</li><li>Choose one practical next step. Later, compare what happened with what you imagined.</li></ol><p className="med-help">Your aspirations can include work, money, relationships, or everyday life. Visualization is a reflective practice; it doesn’t promise particular external outcomes.</p></section></PublicShell>
}
