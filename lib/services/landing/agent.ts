import { z } from 'zod'
import {
  DEFAULT_LANDING_MODEL,
  generateStructured,
  type AiCredentials,
  type AiResult,
} from '@/lib/providers/ai'
import type { LandingTemplateKey, LandingThemeKey } from './options'

export const authorLandingAgentInputSchema = z.object({
  bookTitle: z.string().trim().min(1),
  authorName: z.string().trim().min(1),
  authorPersona: z.string().trim().optional(), // Background, origin story, occupation
  authorVoice: z.string().trim().optional(), // Tone: literary, gritty, witty, atmospheric
  authorQuote: z.string().trim().optional(), // Guiding philosophy or personal quote
  primaryObjective: z.enum(['preorder', 'newsletter', 'brand', 'speaking']).default('preorder'),
  targetAudience: z.string().trim().optional(), // Comp titles, reader demographics
  readerMagnet: z.string().trim().optional(), // Free gift: prequel, deleted scenes, bonus chapter
  otherWorks: z.string().trim().optional(), // Series, backlist books
  accolades: z.string().trim().optional(), // Awards, bestseller status, starred reviews
  templatePreference: z.enum(['bestseller', 'editorial', 'fantasy', 'minimal', 'romance']).optional(),
  themePreference: z.enum(['matt', 'dark', 'light']).optional(),
})

export type AuthorLandingAgentInput = z.infer<typeof authorLandingAgentInputSchema>

export const authorLandingAgentOutputSchema = z.object({
  headline: z.string(),
  subtitle: z.string(),
  authorBio: z.string(),
  authorQuote: z.string(),
  synopsis: z.string(),
  ctaText: z.string(),
  newsletterHeading: z.string(),
  newsletterIncentive: z.string(),
  recommendedTemplate: z.enum(['bestseller', 'editorial', 'fantasy', 'minimal', 'romance']),
  recommendedTheme: z.enum(['matt', 'dark', 'light']),
  recommendedAccent: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).describe('Hex colour, e.g. #6366f1'),
  reviews: z.array(
    z.object({
      quote: z.string(),
      reviewer: z.string(),
      outlet: z.string().optional(),
    })
  ),
})

export type AuthorLandingAgentOutput = z.infer<typeof authorLandingAgentOutputSchema>

export function sampleAuthorLanding(input: AuthorLandingAgentInput): AuthorLandingAgentOutput {
  const author = input.authorName || 'Acclaimed Author'
  const title = input.bookTitle || 'Untitled Masterpiece'
  const objective = input.primaryObjective || 'preorder'

  const ctaMap = {
    preorder: 'Order Your Copy Today',
    newsletter: 'Join Inner Circle & Read Free Excerpt',
    brand: 'Explore The Universe & Books',
    speaking: 'Inquire for Speaking & Press',
  }

  const templateMap: Record<string, LandingTemplateKey> = {
    preorder: 'bestseller',
    newsletter: 'minimal',
    brand: 'fantasy',
    speaking: 'editorial',
  }

  return {
    headline: `The Groundbreaking New Release from ${author}`,
    subtitle: `An electrifying exploration of courage, consequence, and destiny.`,
    authorBio: input.authorPersona
      ? `${author} is ${input.authorPersona}. Known for their distinctive storytelling voice and compelling characters, their work captures the imagination of readers worldwide.`
      : `${author} is an acclaimed storyteller whose work explores complex characters, vivid worlds, and unforgettable emotional journeys.`,
    authorQuote:
      input.authorQuote ||
      `"Stories are the only compass we have to navigate the uncharted corners of human nature."`,
    synopsis: `In ${title}, an ordinary life is shattered by an astonishing revelation that challenges everything previously taken for granted. As unseen forces gather and hidden loyalties are put to the ultimate test, an unforgettable journey unfolds—rich with breathless pacing and profound emotional resonance.`,
    ctaText: ctaMap[objective] || 'Order Your Copy Today',
    newsletterHeading: `Join ${author}’s Reader Inner Circle`,
    newsletterIncentive:
      input.readerMagnet ||
      'Receive exclusive bonus chapters, author annotations, and early access to upcoming releases.',
    recommendedTemplate: input.templatePreference || templateMap[objective] || 'bestseller',
    recommendedTheme: input.themePreference || 'matt',
    recommendedAccent: '#6366f1',
    reviews: [
      {
        quote: `A tour de force. ${author} crafts an unforgettable world with breathtaking precision.`,
        reviewer: 'Literary Review Quarterly',
        outlet: 'Starred Review',
      },
      {
        quote: `Impossible to put down. Destined to be one of the most talked-about books of the year.`,
        reviewer: 'The Sunday Gazette',
        outlet: 'Editor’s Choice',
      },
      {
        quote: `Electrifying storytelling from a master of the craft.`,
        reviewer: 'Book World International',
        outlet: 'Featured Pick',
      },
    ],
  }
}

const SYSTEM = `You are a book marketing strategist writing the actual copy for an author's landing page.

Rules you never break:
- Never invent an award, a bestseller list, a sales figure, a named critic or a publication. Reviews you write must read as reader-voiced praise attributed to a generic outlet, never to a real one.
- Write about this book and this author. Copy that would fit any book is a failure.
- No "New York Times bestselling" unless the publisher stated it in the accolades.
- Headline earns the scroll, subtitle explains, synopsis sells the premise without spoiling the ending.
- Pick the template and theme that fit the genre and objective, not the flashiest one.
- recommendedAccent must be a hex colour like #6366f1.`

const OBJECTIVES: Record<AuthorLandingAgentInput['primaryObjective'], string> = {
  preorder: 'Drive retail sales and pre-orders. The buy buttons are the page.',
  newsletter: 'Capture email signups with a reader magnet. The gift is the page.',
  brand: 'Establish the author and their wider body of work. The author is the page.',
  speaking: 'Win media, podcast and speaking bookings. Credibility is the page.',
}

export async function runAuthorLandingAgent(
  input: AuthorLandingAgentInput,
  credentials?: AiCredentials
): Promise<AiResult<AuthorLandingAgentOutput>> {
  const prompt = [
    `Book title: ${input.bookTitle}`,
    `Author: ${input.authorName}`,
    `Objective: ${input.primaryObjective} — ${OBJECTIVES[input.primaryObjective]}`,
    input.authorPersona ? `Author background: ${input.authorPersona}` : null,
    input.authorVoice ? `Author voice: ${input.authorVoice}` : null,
    input.authorQuote ? `Author's own words: ${input.authorQuote}` : null,
    input.targetAudience ? `Readers and comparable titles: ${input.targetAudience}` : null,
    input.readerMagnet ? `Reader magnet on offer: ${input.readerMagnet}` : null,
    input.otherWorks ? `Other works: ${input.otherWorks}` : null,
    input.accolades ? `Verified accolades (the only ones you may cite): ${input.accolades}` : 'No accolades supplied — cite none.',
    input.templatePreference ? `Publisher prefers the ${input.templatePreference} template.` : null,
    input.themePreference ? `Publisher prefers the ${input.themePreference} theme.` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return generateStructured({
    label: 'landing-page',
    schema: authorLandingAgentOutputSchema,
    system: SYSTEM,
    prompt,
    credentials,
    model: process.env.OPENROUTER_LANDING_MODEL || DEFAULT_LANDING_MODEL,
    temperature: 0.75,
    timeoutMs: 60_000,
    fallback: () => sampleAuthorLanding(input),
  })
}
