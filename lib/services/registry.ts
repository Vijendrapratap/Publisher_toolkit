export type ServiceKey = 'create-book' | 'ads' | 'audiobook' | 'landing' | 'trailer'
export type ServiceIconName = 'book-open' | 'sparkles' | 'megaphone' | 'clapperboard' | 'headphones' | 'layout-template'

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
    key: 'create-book',
    name: 'Create Your Book',
    tagline: 'Generate children books, coloring books, word games & novels.',
    description:
      'Write complete books chapter-by-chapter, generate illustrated children stories, create coloring books with clean vector outlines, or build word game puzzles in any aesthetic style.',
    href: '/create-book',
    icon: 'book-open',
    tintClass: 'bg-tint-create-book',
    availability: 'live',
    highlights: [
      "Children's illustrated storybook spreads",
      'Coloring book line-art pages & themes',
      'Playable word searches & crossword puzzles',
      'Chapter-by-chapter novel & outline generator',
      '1-click export to Amazon Ads & A+ Content',
    ],
  },
  {
    key: 'ads',
    name: 'Ads Creative',
    tagline: 'Scroll-stopping ads & A+ content in minutes.',
    description:
      'Upload your book and get ready-to-run ad images, Amazon KDP A+ Content modules, and Remotion HD video trailers.',
    href: '/ads',
    icon: 'megaphone',
    tintClass: 'bg-tint-ads',
    availability: 'live',
    highlights: ['Cover and internal pages pulled or uploaded', 'Amazon A+ modules (970×600, 970×300, 300×300)', 'Remotion HD video trailers included'],
  },
  {
    key: 'landing',
    name: 'Landing Page & Website',
    tagline: 'A home on the web for your book.',
    description: 'Generate a polished, responsive landing page for your book and author profile with instant public links and HTML export.',
    href: '/landing',
    icon: 'layout-template',
    tintClass: 'bg-tint-landing',
    availability: 'live',
    highlights: ['Designed templates & Matt theme', 'Live desktop and mobile preview', 'Instant public URL & static HTML export'],
  },
  {
    key: 'audiobook',
    name: 'Audio Book',
    tagline: 'Your book, beautifully narrated.',
    description: 'Create a chapter-by-chapter audiobook from your manuscript with natural Fish Audio & Qwen TTS neural voices.',
    href: '/audiobook',
    icon: 'headphones',
    tintClass: 'bg-tint-audiobook',
    availability: 'coming-soon',
    highlights: ['Automatic chapter detection', 'Fish Audio & Qwen TTS neural voices', 'Multi-speaker character voiceover coming soon'],
  },
]

export const ALL_SERVICES: ServiceDefinition[] = [
  ...SERVICES,
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
]

export function getService(key: ServiceKey): ServiceDefinition {
  return ALL_SERVICES.find((s) => s.key === key) ?? SERVICES[0]
}
