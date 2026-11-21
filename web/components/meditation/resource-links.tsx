import Link from 'next/link'
import { ArrowUpRight, BookOpen, Mail, Play, Sparkles, FileText } from 'lucide-react'
import { RESOURCES } from '@/lib/meditation/resources'

const icons: Record<string, typeof BookOpen> = { youtube: Play, worksheet: FileText, workbook: BookOpen, newsletter: Mail, custom: Sparkles }
export function ResourceLinks({ compact = false }: { compact?: boolean }) {
  const resources = compact ? RESOURCES.filter(resource => ['worksheet', 'custom'].includes(resource.id)) : RESOURCES
  return <div className={`med-resource-grid ${compact ? 'is-compact' : ''}`}>{resources.map(resource => {
    const Icon = icons[resource.id] || BookOpen
    const body = <><div className="med-resource-top"><Icon size={23} strokeWidth={1.4} />{resource.href ? <ArrowUpRight size={18} /> : <span className="med-status-pill">Coming soon</span>}</div><h3>{resource.title}</h3><p>{resource.description}</p></>
    return resource.href ? <Link key={resource.id} className="med-resource-card is-link" href={resource.href} {...(resource.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</Link> : <article className="med-resource-card" key={resource.id}>{body}</article>
  })}</div>
}
