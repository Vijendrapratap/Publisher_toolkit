import type { AdCopyResult } from './copy'

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

const HOOKS: Record<string, (title: string) => string> = {
  literary: (t) => `Lose yourself in ${t}`,
  punchy: (t) => `${t}. Don't miss it.`,
  bold: (t) => `${t} changes everything`,
  intriguing: (t) => `What secrets hide in ${t}?`,
  social: (t) => `The book everyone is reading: ${t}`,
}

const OBJECTIVE_HOOKS: Record<string, (title: string) => string> = {
  launch: (t) => `Now Available: ${t}`,
  preorder: (t) => `Pre-Order Now: ${t}`,
  discount: (t) => `Special 99¢ Deal: ${t}`,
  review_quote: (t) => `★★★★★ Must-Read: ${t}`,
  tropes: (t) => `Your Next Obsession: ${t}`,
  evergreen: (t) => `Discover ${t}`,
}

// Local-mode stand-in for Claude: believable, length-safe copy built from the
// book's own metadata, so the Results screen is never empty offline.
export function sampleAdCopy(
  book: { title: string; author: string; blurb: string },
  tone = 'literary',
  options?: { campaignObjective?: string; customHook?: string; ctaText?: string }
): AdCopyResult[] {
  const title = book.title.trim() || 'Your next great read'
  const byline = book.author.trim() ? ` by ${book.author.trim()}` : ''
  const blurb = book.blurb.trim() || `Discover ${title}${byline}.`
  const defaultHook = (HOOKS[tone] ?? HOOKS.literary)(title)
  const hook = options?.customHook?.trim()
    ? options.customHook.trim()
    : options?.campaignObjective && OBJECTIVE_HOOKS[options.campaignObjective]
      ? OBJECTIVE_HOOKS[options.campaignObjective](title)
      : defaultHook

  return [
    {
      platform: 'META',
      headline: clip(hook, 40),
      primaryText: clip(blurb, 125),
      description: clip(`${title}${byline}`, 90),
    },
    {
      platform: 'GOOGLE',
      headline: clip(title, 30),
      primaryText: clip(hook, 90),
      description: clip(blurb, 90),
    },
    {
      platform: 'AMAZON',
      headline: clip(`${title}${byline}`, 80),
      primaryText: clip(blurb, 150),
      description: clip(hook, 90),
    },
  ]
}
