import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getMeditation, MEDITATIONS } from '@/lib/meditation/content'
import { MeditationComposer } from '@/components/meditation/composer'

export function generateStaticParams() { return MEDITATIONS.filter(meditation => meditation.status === 'published').map(meditation => ({ id: meditation.id })) }
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const meditation = getMeditation(params.id)
  return { title: meditation ? `${meditation.title} · Floviate` : 'Meditation · Floviate', description: meditation?.description }
}
export default function MeditationPage({ params }: { params: { id: string } }) {
  const meditation = getMeditation(params.id)
  if (!meditation || meditation.status !== 'published' || meditation.availability !== 'free') notFound()
  return <MeditationComposer meditation={meditation} />
}
