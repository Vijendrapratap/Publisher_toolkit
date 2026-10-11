import { generateAiImage, generateStructured, getVisionModelName, type AiResult } from '@/lib/providers/ai'
import { storeFile } from '@/lib/providers/storage'
import { AD_FONTS } from './videoBasics'
import {
  STORYBOARD_LIMITS,
  fixedStoryboard,
  sanitizeStoryboard,
  settingsPath,
  storyboardDraftSchema,
  type Storyboard,
} from './storyboard'
import type { AdVideoSpec } from './videoSpec'

export const DIRECTOR_SYSTEM = `You direct short video ads that sell books on Amazon and in social feeds. You look at the book's real cover and inside pages, read its details, and write the storyboard our video engine plays.

How these ads are watched:
- They autoplay with the sound off, often in a small tile. Every word is read, not heard.
- People decide in the first two seconds. The first beat must make them curious or show them something they want.

What the engine does with your storyboard:
- It always shows the real cover as a 3D book and the real inside pages. It never redraws them, so never describe changes to them.
- It draws one background setting from your description and places the book in it.
- Each beat is one scene of 2 to 4 seconds. Scenes blend into each other.

Beat types:
- hook: the opening line beside the book. Open with a question, a tension or the strongest promise.
- titleCard: one sentence alone on a dark card, like a film trailer. For stories, tell the premise in 2 to 4 short cards.
- pageZoom: one inside page fills the screen and the camera moves in to the part you choose (focus x and y from 0 to 1 across and down the page, zoom 1.3 to 2.5). Use it to prove a line with the page itself; its text is a short caption.
- bookOpen: the book opens on a page and the page after it. Use it to show what is inside.
- proof: a concrete, checkable fact, shown beside the cover or a page ("120 cases. One per page.").
- audience: who the book is for, or who it is a gift for.
- endCard: the title, an optional series or subtitle line, and the call to action. Always last, exactly once.

How to build it:
- 4 to 8 beats, then the end card. Order: hook first, then what is inside with real numbers, then who it is for, then the end card.
- Puzzle, activity and colouring books: show pages early (bookOpen, pageZoom) and lead with counts and print size.
- Stories and novels: lead with tension (a hook or titleCards with the premise), then the book.
- Children's books: warmth, the age range and what the child gets.
- Non-fiction: the reader's problem, then what they will be able to do.

Writing rules:
- One idea per beat. At most 7 words a line and at most 2 lines; break the line where a reader would pause.
- Use only numbers and claims found in the book's details or clearly visible on its pages. Never invent awards, rankings, review quotes, prices or counts.
- Keep the title and author out of the hook; the end card carries the title.
- Write in the language of the book's details.

Look and feel:
- palette: three hex colours taken from the cover: bg (a deep or soft colour from the cover for the background), ink (a text colour readable on bg) and accent (a highlight colour from the cover).
- font: one of ${AD_FONTS.map((f) => f.key).join(', ')}. Serif (playfair, lora, cinzel, merriweather) for literary, mystery and history; bold condensed (bebas, montserrat) for puzzles and activity books; caveat for young children; inter for non-fiction.
- particles: leaves, snow, dust, embers or none, to match the setting and season.
- settingPrompt: one place where the book could sit, matching the genre and season: a surface in the foreground with empty space, soft light, the background out of focus. No text, no book, no people's faces.
- cornerCover: true for trailer-style ads made mostly of title cards, otherwise false.`

export interface DirectorFacts {
  title: string
  author?: string | null
  blurb?: string | null
  bullets?: string[]
  categories?: string[]
  printLength?: number | null
  pageCount: number
  cta: string
  hook?: string | null
}

export interface DirectorImage {
  /** "cover" or "page N"; listed in the prompt so the model knows which picture is which. */
  label: string
  data: Buffer
  mediaType: string
}

export interface DirectorOptions {
  format: AdVideoSpec['format']
  lengthSec: number
  mood: string
  style: AdVideoSpec['style']
  current?: Storyboard
  instruction?: string
}

export function buildDirectorPrompt(facts: DirectorFacts, images: DirectorImage[], options: DirectorOptions): string {
  const pages = Math.min(facts.pageCount, STORYBOARD_LIMITS.pages)
  const lines = [
    `Title: ${facts.title}`,
    facts.author ? `Author: ${facts.author}` : null,
    facts.categories?.length ? `Categories: ${facts.categories.join(', ')}` : null,
    facts.printLength ? `Print length: ${facts.printLength} pages` : null,
    facts.bullets?.length ? `Publisher's bullets (verified):\n- ${facts.bullets.join('\n- ')}` : null,
    facts.blurb ? `Description: ${facts.blurb.slice(0, 1500)}` : null,
    `Images attached, in this order: ${images.map((i) => i.label).join(', ') || 'none'}`,
    pages > 0 ? `Inside pages you can show: 1 to ${pages}` : 'There are no inside pages: do not use pageZoom or bookOpen.',
    `Video shape: ${options.format}. Target length: about ${options.lengthSec} seconds. Mood: ${options.mood}.`,
    `Call to action to use on the end card: ${facts.cta}`,
    '',
  ]
  if (options.current) {
    lines.push(
      'Here is the current storyboard as JSON. Revise it following the publisher’s instruction and keep everything the instruction does not ask to change.',
      JSON.stringify(options.current),
      '',
      `Publisher's instruction: ${options.instruction || 'Make it more compelling.'}`
    )
  } else if (options.instruction) {
    lines.push(`Publisher's direction: ${options.instruction}`)
  }
  return lines.filter((l) => l !== null).join('\n')
}

export async function directAd(facts: DirectorFacts, images: DirectorImage[], options: DirectorOptions): Promise<AiResult<Storyboard>> {
  const ctx = { pageCount: facts.pageCount, title: facts.title, cta: facts.cta, lengthSec: options.lengthSec, style: options.style }
  const result = await generateStructured({
    label: options.current ? 'ad-director-revise' : 'ad-director',
    schema: storyboardDraftSchema,
    system: DIRECTOR_SYSTEM,
    prompt: buildDirectorPrompt(facts, images, options),
    images: images.map(({ data, mediaType }) => ({ data, mediaType })),
    model: getVisionModelName(),
    temperature: 0.8,
    timeoutMs: 60_000,
    // A failed revision must not throw away what the publisher already has.
    fallback: () =>
      options.current ??
      fixedStoryboard({ title: facts.title, pageCount: facts.pageCount, cta: facts.cta, hook: facts.hook, bullets: facts.bullets, lengthSec: options.lengthSec, style: options.style }),
  })
  if (result.source === 'fallback' && options.current) return { ...result, data: options.current }
  return { ...result, data: sanitizeStoryboard(result.data, ctx) }
}

const SHAPE_WORDS: Record<AdVideoSpec['format'], string> = {
  '16:9': 'Wide landscape frame',
  '1:1': 'Square frame',
  '9:16': 'Tall portrait frame',
}

/** Draws the ad's background once and stores it; null when there is nothing to draw or drawing failed. */
export async function drawSetting(prompt: string, format: AdVideoSpec['format'], publisherId: string): Promise<string | null> {
  if (!prompt.trim()) return null
  const image = await generateAiImage(
    `${prompt.trim()}. ${SHAPE_WORDS[format]}. Cinematic photograph, soft directional light, shallow depth of field, rich but uncluttered. Leave clear empty space for a book and a line of text. No text, letters, logos, books or faces.`,
    { timeoutMs: 90_000 }
  )
  if (!image) return null
  const ext = image.contentType.includes('png') ? 'png' : image.contentType.includes('webp') ? 'webp' : 'jpg'
  const name = `${settingsPath(publisherId)}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  return (await storeFile(name, image.buffer, image.contentType)).url
}
