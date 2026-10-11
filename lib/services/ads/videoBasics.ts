/** Shared by videoSpec.ts and storyboard.ts; kept apart so neither imports the other at runtime. */
export const AD_FONTS = [
  { key: 'inter', label: 'Inter' },
  { key: 'montserrat', label: 'Montserrat' },
  { key: 'bebas', label: 'Bebas Neue' },
  { key: 'playfair', label: 'Playfair Display' },
  { key: 'lora', label: 'Lora' },
  { key: 'cinzel', label: 'Cinzel' },
  { key: 'merriweather', label: 'Merriweather' },
  { key: 'caveat', label: 'Caveat' },
] as const
export type AdFontKey = (typeof AD_FONTS)[number]['key']

export const FPS = 30

/** Cuts at a word boundary so an automatic default never ends mid-word. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const head = clean.slice(0, max + 1)
  const lastSpace = head.lastIndexOf(' ')
  const cut = lastSpace > max * 0.5 ? head.slice(0, lastSpace) : clean.slice(0, max)
  return cut.replace(/[\s,;:•–—-]+$/, '')
}
