import { z } from 'zod'
import { clip } from './videoSpec'

export const BRIEF_LIMITS = { shots: 3, prompt: 600, caption: 40, headline: 48, cta: 28 } as const

export const aiVideoShotSchema = z.object({
  prompt: z.string().trim().min(10, 'Describe each shot in a sentence or two').max(BRIEF_LIMITS.prompt),
  sourceImage: z.string().regex(/^(cover|page-\d+)$/),
  durationSec: z.number().int().min(3).max(10),
  caption: z.string().trim().max(BRIEF_LIMITS.caption),
})

export const aiVideoBriefSchema = z.object({
  shots: z.array(aiVideoShotSchema).min(1, 'Keep at least one shot').max(BRIEF_LIMITS.shots),
  endCard: z.object({
    headline: z.string().trim().min(1, 'Add an end-card headline').max(BRIEF_LIMITS.headline),
    cta: z.string().trim().min(1, 'Add a call to action').max(BRIEF_LIMITS.cta),
  }),
})
export type AiVideoBrief = z.infer<typeof aiVideoBriefSchema>
export type AiVideoShot = AiVideoBrief['shots'][number]

export interface BriefFacts {
  title: string
  author?: string | null
  blurb?: string | null
  bullets?: string[]
  categories?: string[]
  cta?: string | null
  pageCount: number
}

/** The images a shot may start from: the cover and each uploaded page. */
export function imageKeys(pageCount: number): string[] {
  return ['cover', ...Array.from({ length: pageCount }, (_, i) => `page-${i + 1}`)]
}

export const BRIEF_SYSTEM = `You are the creative director of short video ads that sell books. You write the shot list that an image-to-video model will animate.

How the video is made:
- Each shot starts from ONE real image — the book's cover or one of its interior pages — and the model animates it. It does not invent a new scene; it moves the camera, the light and the atmosphere of that image.
- After the shots, we add an end card ourselves with the real cover, a headline and a call to action.
- Captions are added by us on top of shots, in the ad's own font.

Rules for every shot prompt:
- Describe motion, not a new picture: the camera move (slow push-in, parallax drift, gentle orbit, tilt), the light (sweep, glow, flicker, dawn) and the atmosphere (dust, embers, rain, drifting paper).
- Never ask for text, titles, letters or changes to the cover design. Video models misspell text.
- Match the book's genre and emotional tone: a children's book feels warm and playful, a thriller tense, a technical book confident and clear.
- One or two concrete, visual sentences. No brand names, no real people, no claims.

Together the shots must feel like one experience: open with intrigue, build towards the book's promise, and hand off to the end card.

Captions: at most 40 characters, readable in one second; use them on at most two shots and leave the others empty. End-card headline: the single strongest reason to read this book, at most 48 characters. Call to action: at most 28 characters.
Never invent awards, rankings, review quotes or numbers. Write in the language of the book's details.`

export function buildBriefPrompt(
  facts: BriefFacts,
  options: { current?: AiVideoBrief; instruction?: string; format: string }
): string {
  const lines: (string | null)[] = [
    `Book: ${facts.title}`,
    facts.author ? `Author: ${facts.author}` : null,
    facts.categories?.length ? `Categories: ${facts.categories.join(', ')}` : null,
    facts.bullets?.length ? `Publisher's bullets:\n- ${facts.bullets.join('\n- ')}` : null,
    facts.blurb ? `Description: ${facts.blurb.slice(0, 1500)}` : null,
    `Video format: ${options.format}`,
    `Images shots can start from: ${imageKeys(facts.pageCount).join(', ')} ("cover" is the front cover; "page-N" is interior page N).`,
    facts.cta ? `Preferred call to action: ${facts.cta}` : null,
    '',
  ]
  const instruction = options.instruction?.trim()
  if (options.current) {
    lines.push(
      "Here is the current shot list as JSON. Revise it following the publisher's instruction and keep everything the instruction does not ask to change.",
      JSON.stringify(options.current),
      '',
      `Publisher's instruction: ${instruction || 'Make it more compelling.'}`
    )
  } else {
    lines.push('Write 2 or 3 shots of 4 to 6 seconds each, then the end card.')
    if (instruction) lines.push(`Publisher's direction: ${instruction}`)
  }
  return lines.filter((l): l is string => l !== null).join('\n')
}

/** Keeps a model's answer inside what can actually be rendered. */
export function sanitizeBrief(brief: AiVideoBrief, keys: string[]): AiVideoBrief {
  return {
    ...brief,
    shots: brief.shots.map((shot) => ({ ...shot, sourceImage: keys.includes(shot.sourceImage) ? shot.sourceImage : 'cover' })),
  }
}

/** Used when the text model is unavailable, so the publisher still has something to edit. */
export function fallbackBrief(facts: Pick<BriefFacts, 'title' | 'cta' | 'pageCount'>): AiVideoBrief {
  const shots: AiVideoShot[] = [
    {
      prompt: 'Slow cinematic push-in on the book cover, a soft band of light sweeping across it, fine dust drifting in the air, shallow depth of field.',
      sourceImage: 'cover',
      durationSec: 5,
      caption: clip(facts.title, BRIEF_LIMITS.caption),
    },
  ]
  if (facts.pageCount > 0) {
    shots.push({
      prompt: 'Gentle parallax drift across the page, warm light slowly brightening, subtle paper texture, calm and inviting.',
      sourceImage: 'page-1',
      durationSec: 5,
      caption: '',
    })
  }
  return {
    shots,
    endCard: { headline: clip(facts.title, BRIEF_LIMITS.headline), cta: clip(facts.cta || 'Get your copy today', BRIEF_LIMITS.cta) },
  }
}
