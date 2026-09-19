import { generateText, Output } from 'ai'
import { z } from 'zod'
import { isAiConfigured, getLandingPageModel } from '@/lib/providers/ai'
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
  recommendedAccent: z.string(),
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

export async function runAuthorLandingAgent(
  input: AuthorLandingAgentInput
): Promise<AuthorLandingAgentOutput> {
  if (!isAiConfigured()) {
    return sampleAuthorLanding(input)
  }

  const objectiveDescriptions = {
    preorder: 'Maximize retail book sales and pre-orders on Amazon, Barnes & Noble, and Apple Books.',
    newsletter: 'Build a dedicated author fanbase and capture email leads via an enticing reader magnet gift.',
    brand: 'Establish author authority, introduce the overarching literary series universe and backlist.',
    speaking: 'Position the author for prestigious media appearances, podcast interviews, and speaking keynotes.',
  }

  const prompt = `You are a world-class book marketing strategist and author brand architect.
Design a cohesive, high-converting author and book landing page.
CRITICAL: The landing page must celebrate the AUTHOR as well as the book, establishing author brand credibility, voice, and deep reader connection.

CAMPAIGN DETAILS:
Book Title: ${input.bookTitle}
Author Name: ${input.authorName}
Primary Objective: ${input.primaryObjective} (${objectiveDescriptions[input.primaryObjective] || ''})
Author Background / Origin Story: ${input.authorPersona || 'Accomplished author with a unique voice'}
Author Voice / Tone: ${input.authorVoice || 'Compelling, authoritative, emotionally resonant'}
Author Quote or Philosophy: ${input.authorQuote || 'Reflective of their writing mission'}
Target Readers / Comps: ${input.targetAudience || 'Discerning readers of contemporary fiction & narrative nonfiction'}
Reader Magnet Incentive: ${input.readerMagnet || 'Free bonus chapter & author commentary'}
Author Other Works / Series: ${input.otherWorks || 'First in series or standalone work'}
Accolades & Achievements: ${input.accolades || 'Praise from critics and readers'}

Generate tailored, publication-ready landing page copy matching this exact objective and author voice.`

  try {
    const { output } = await generateText({
      model: getLandingPageModel(),
      output: Output.object({ schema: authorLandingAgentOutputSchema }),
      prompt,
    })

    return output
  } catch (err) {
    console.error('[Landing Page Agent] DeepSeek v4.1 generation failed, falling back to sample', err)
    return sampleAuthorLanding(input)
  }
}
