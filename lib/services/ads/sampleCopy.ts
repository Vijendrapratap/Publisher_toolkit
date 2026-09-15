import type { AdCopyResult } from './copy'

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

const HOOKS: Record<string, (title: string) => string> = {
  literary: (t) => `Lose yourself in ${t}`,
  punchy: (t) => `${t}. Don't miss it.`,
  bold: (t) => `${t} changes everything`,
}

// Local-mode stand-in for Claude: believable, length-safe copy built from the
// book's own metadata, so the Results screen is never empty offline.
export function sampleAdCopy(book: { title: string; author: string; blurb: string }, tone = 'literary'): AdCopyResult[] {
  const title = book.title.trim() || 'Your next great read'
  const byline = book.author.trim() ? ` by ${book.author.trim()}` : ''
  const blurb = book.blurb.trim() || `Discover ${title}${byline}.`
  const hook = (HOOKS[tone] ?? HOOKS.literary)(title)

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
