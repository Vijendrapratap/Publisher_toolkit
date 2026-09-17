export type ServiceKey = 'ads' | 'trailer' | 'audiobook' | 'landing'
export type ServiceIconName = 'megaphone' | 'clapperboard' | 'headphones' | 'layout-template'

export interface ServiceDefinition {
  key: ServiceKey
  name: string
  tagline: string
  description: string
  href: string
  icon: ServiceIconName
  tintClass: string
  availability: 'live' | 'coming-soon'
  highlights: string[]
}

export const SERVICES: ServiceDefinition[] = [
  {
    key: 'ads',
    name: 'Ads Creative',
    tagline: 'Scroll-stopping ads from your book in minutes.',
    description:
      'Upload your book and get ready-to-run ad images and copy for Meta, Google and Amazon, sized perfectly for every placement.',
    href: '/ads',
    icon: 'megaphone',
    tintClass: 'bg-tint-ads',
    availability: 'live',
    highlights: ['Cover and blurb pulled from your PDF', 'AI-written copy per platform', 'Every ad size, ready to download or push'],
  },
  {
    key: 'trailer',
    name: 'Trailer Video',
    tagline: 'A cinematic trailer that sells the story.',
    description: 'Turn your cover and pages into a short, shareable book trailer for Reels, Shorts and YouTube.',
    href: '/trailer',
    icon: 'clapperboard',
    tintClass: 'bg-tint-trailer',
    availability: 'live',
    highlights: ['15, 30 or 60 second cuts', 'Vertical, square and widescreen', 'Mood-matched music'],
  },
  {
    key: 'audiobook',
    name: 'Audio Book',
    tagline: 'Your book, beautifully narrated.',
    description: 'Create a chapter-by-chapter audiobook from your manuscript, in a voice modeled on your reference clip.',
    href: '/audiobook',
    icon: 'headphones',
    tintClass: 'bg-tint-audiobook',
    availability: 'coming-soon',
    highlights: ['Automatic chapter detection', 'Narration from a reference voice', 'Download per chapter or complete'],
  },
  {
    key: 'landing',
    name: 'Landing Page & Website',
    tagline: 'A home on the web for your book.',
    description: 'Generate a polished landing page for your book and author profile, ready to preview, export or publish.',
    href: '/landing',
    icon: 'layout-template',
    tintClass: 'bg-tint-landing',
    availability: 'coming-soon',
    highlights: ['Designed templates', 'Live desktop and mobile preview', 'Export clean HTML'],
  },
]

export function getService(key: ServiceKey): ServiceDefinition {
  return SERVICES.find((s) => s.key === key)!
}
