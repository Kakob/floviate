export interface MeditationResource {
  id: 'youtube' | 'worksheet' | 'workbook' | 'newsletter' | 'custom'
  title: string
  description: string
  href: string | null
}

/** Only expose configured HTTP(S) destinations or intentional internal routes. */
export function resourceHref(value: string | undefined): string | null {
  if (!value?.trim()) return null
  const href = value.trim()
  try {
    if (href.startsWith('/')) {
      const base = 'https://floviate.invalid'
      return new URL(href, base).origin === base ? href : null
    }
    const url = new URL(href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? href : null
  } catch {
    return null
  }
}

export const RESOURCES: MeditationResource[] = [
  {
    id: 'youtube',
    title: 'Watch on YouTube',
    description: 'Explore the practice and follow a guided visualization.',
    href: resourceHref(process.env.NEXT_PUBLIC_YOUTUBE_URL),
  },
  {
    id: 'worksheet',
    title: 'Get the free worksheet',
    description: 'Make space for a desire, a memory, a present opportunity, a future feeling, and one practical action.',
    href: resourceHref(process.env.NEXT_PUBLIC_FREE_WORKSHEET_URL),
  },
  {
    id: 'workbook',
    title: 'The seven-day workbook · $10',
    description: 'A reflective practice to explore your feelings and compare real experiences with what you imagined.',
    href: resourceHref(process.env.NEXT_PUBLIC_WORKBOOK_URL),
  },
  {
    id: 'newsletter',
    title: 'Join the newsletter',
    description: 'Hear about new meditations and the next chapter of Floviate.',
    href: resourceHref(process.env.NEXT_PUBLIC_NEWSLETTER_URL),
  },
  {
    id: 'custom',
    title: 'Create a custom meditation',
    description: 'Start with your own intention, memories, and visualizations.',
    href: resourceHref(process.env.NEXT_PUBLIC_CUSTOM_MEDITATION_URL) ?? '/custom',
  },
]
