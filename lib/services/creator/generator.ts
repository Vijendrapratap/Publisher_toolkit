import { generateStructured, type AiCredentials, type AiResult } from '@/lib/providers/ai'
import {
  CONTENT_SCHEMAS,
  chapterProseSchema,
  type BookContentDraft,
  type WordGameDraft,
} from './schemas'
import type { ZodType } from 'zod'
import type {
  StoryPage,
  ColoringPage,
  WordSearchPuzzle,
  CrosswordPuzzle,
  ChapterItem,
  NovelContent,
  ShortStoryContent,
  GeneratedBookContent,
} from './types'
import type { BookTypeKey, CreateBookProjectInput } from './options'

/**
 * Generates a valid NxN word search matrix with words placed into the grid
 */
export function buildWordSearchGrid(
  words: string[],
  size: number = 12
): { grid: string[][]; placedWords: string[] } {
  // Initialize grid with empty strings
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''))
  const placedWords: string[] = []
  const uppercaseWords = words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))

  const directions = [
    { dr: 0, dc: 1 },  // horizontal right
    { dr: 1, dc: 0 },  // vertical down
    { dr: 1, dc: 1 },  // diagonal down-right
  ]

  for (const word of uppercaseWords) {
    if (word.length > size || word.length < 2) continue
    let placed = false
    let attempts = 0

    while (!placed && attempts < 50) {
      attempts++
      const dir = directions[Math.floor(Math.random() * directions.length)]
      const maxRow = dir.dr === 1 ? size - word.length : size - 1
      const maxCol = dir.dc === 1 ? size - word.length : size - 1

      if (maxRow < 0 || maxCol < 0) continue

      const startR = Math.floor(Math.random() * (maxRow + 1))
      const startC = Math.floor(Math.random() * (maxCol + 1))

      // Check if fit
      let canFit = true
      for (let i = 0; i < word.length; i++) {
        const r = startR + i * dir.dr
        const c = startC + i * dir.dc
        if (grid[r][c] !== '' && grid[r][c] !== word[i]) {
          canFit = false
          break
        }
      }

      if (canFit) {
        for (let i = 0; i < word.length; i++) {
          grid[startR + i * dir.dr][startC + i * dir.dc] = word[i]
        }
        placedWords.push(word)
        placed = true
      }
    }
  }

  // Fill remaining empty cells with random letters
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)]
      }
    }
  }

  return { grid, placedWords }
}

/**
 * Deterministic, rich sample generator for instant offline preview and tests
 */
export function sampleBookContent(input: CreateBookProjectInput): GeneratedBookContent {
  const { title, bookType, promptConcept, styleTheme, targetAudience, pageCount = 8 } = input

  if (bookType === 'children') {
    const pages: StoryPage[] = [
      {
        pageNumber: 1,
        spreadHeading: 'Once Upon a Forest Moon',
        storyText: `Deep in the velvet shadows of the Whispering Woods, where starlight caught on morning dew, lived Barnaby—a little bear with ears as round as teacups and curiosity wide as the sea.`,
        rhymePattern: 'Prose with lyrical rhythm',
        characterFocus: 'Barnaby the curious little bear',
        illustrationPrompt: `${styleTheme} style: Charming little brown bear cub named Barnaby with round ears sitting on a mossy log beneath giant glowing forest mushrooms, soft starlight rays, storybook watercolor wash, fairytale warmth.`,
      },
      {
        pageNumber: 2,
        spreadHeading: 'The Golden Whisper',
        storyText: `Every night, the other animals snuggled into their hollows. But Barnaby stayed awake, watching the constellations spin like silver pinwheels across the sky. Then, with a gentle fizz, something sparkled through the pine needles.`,
        rhymePattern: 'Prose',
        characterFocus: 'Barnaby seeing the falling spark',
        illustrationPrompt: `${styleTheme} style: A golden glowing star drifting softly down between tall pine trees, Barnaby wide-eyed looking up with wonder, cozy night palette with deep indigo and amber glow.`,
      },
      {
        pageNumber: 3,
        spreadHeading: 'A Fallen Friend',
        storyText: `"A star!" Barnaby gasped, pattering forward on soft paws. Nestled in a bed of clover was a tiny, dimming spark. "Don't be afraid," Barnaby whispered. "I'll keep you warm."`,
        rhymePattern: 'Dialogue',
        characterFocus: 'Barnaby cupping the tiny star',
        illustrationPrompt: `${styleTheme} style: Barnaby gently cupping a soft glowing starlight creature in his fluffy paws, luminous warm golden rim light on his fur, cozy whimsical children book art.`,
      },
      {
        pageNumber: 4,
        spreadHeading: 'Pip the Prickly Friend',
        storyText: `From beneath a curled fern popped Pip the hedgehog, his glasses slipping down his snout. "Stars don't belong in clover, Barnaby! They need celestial fuel—or at least a hearty song!"`,
        rhymePattern: 'Character introduction',
        characterFocus: 'Pip the bespectacled hedgehog and Barnaby',
        illustrationPrompt: `${styleTheme} style: A cute little hedgehog wearing tiny round spectacles holding a pocket magnifying glass next to Barnaby, detailed enchanted forest flora, charming narrative illustration.`,
      },
      {
        pageNumber: 5,
        spreadHeading: 'The Song of the Canopy',
        storyText: `Together, Barnaby and Pip hummed the ancient melody of the river stone and the winter sun. With every verse, the star pulsed brighter, its amber rays warming Barnaby's nose.`,
        rhymePattern: 'Melodic prose',
        characterFocus: 'The duo singing together',
        illustrationPrompt: `${styleTheme} style: Swirling musical golden sparkles rising between Barnaby and Pip, glowing starlight illuminating their joyful expressions, gentle whimsical fairytale aesthetic.`,
      },
      {
        pageNumber: 6,
        spreadHeading: 'Back to the Sky',
        storyText: `With a joyful leap, the little star soared into the night sky, blooming into the brightest constellation of all. Barnaby smiled, knowing that even the smallest friend can light up the entire world.`,
        rhymePattern: 'Uplifting resolution',
        characterFocus: 'Barnaby looking up happily at the sky',
        illustrationPrompt: `${styleTheme} style: High angle view of Barnaby and Pip on the forest meadow gazing up at a dazzling star constellation smiling, warm atmospheric lighting, cinematic bedtime story finale.`,
      },
    ]

    return { type: 'children', pages: pages.slice(0, pageCount) }
  }

  if (bookType === 'coloring') {
    const pages: ColoringPage[] = [
      {
        pageNumber: 1,
        title: 'The Starlight Dragon Sleeps',
        sceneDescription: 'A friendly baby dragon curled around a crescent moon surrounded by fluffy clouds and smiling mini stars.',
        lineArtPrompt: `clean black and white coloring book page, ${styleTheme} style, baby dragon sleeping peacefully on a crescent moon, bold crisp contour lines, pure white background, no shading, no gray fills, printable vector outline`,
        detailLevel: 'simple',
      },
      {
        pageNumber: 2,
        title: 'The Mushroom Cottage',
        sceneDescription: 'A detailed fairy tale cottage built inside a giant mushroom with cobblestone steps, smoking chimney, and garden lanterns.',
        lineArtPrompt: `black and white coloring book illustration, ${styleTheme} style, cozy mushroom house with round door, flower window boxes, stone walkway, crisp outlines, no gradients, clean line art for coloring`,
        detailLevel: 'moderate',
      },
      {
        pageNumber: 3,
        title: 'Woodland Tea Party',
        sceneDescription: 'A hedgehog, squirrel, and rabbit having afternoon tea on a tree stump table with teacups and berry tarts.',
        lineArtPrompt: `coloring book page for kids, cute woodland animals having tea around a wooden stump, clean bold line art, high contrast, black and white lineart, easy to color`,
        detailLevel: 'simple',
      },
      {
        pageNumber: 4,
        title: 'Celestial Owl in Flight',
        sceneDescription: 'A majestic horned owl soaring across an ornate night sky filled with geometric constellations and lunar motifs.',
        lineArtPrompt: `intricate adult coloring page, soaring owl with ornate feathers, mandala celestial patterns, clean black lines on stark white, relaxing mindfulness coloring sheet`,
        detailLevel: 'intricate',
      },
      {
        pageNumber: 5,
        title: 'Enchanted Crystal Cavern',
        sceneDescription: 'Giant crystalline formations with glowing water lilies and cascading subterranean waterfalls.',
        lineArtPrompt: `coloring book line art, fantasy crystal cave with stalactites and underground pool, sharp clean outlines, zero shading, high-resolution coloring page`,
        detailLevel: 'moderate',
      },
    ]

    return { type: 'coloring', pages: pages.slice(0, pageCount) }
  }

  if (bookType === 'word_game') {
    const puzzle1Words = ['BARNABY', 'STARLIGHT', 'FOREST', 'MEADOW', 'WHISPER', 'HEDGEHOG', 'CLOVER', 'MOON']
    const p1 = buildWordSearchGrid(puzzle1Words, 12)

    const puzzle2Words = ['CELESTIAL', 'GALAXY', 'NEBULA', 'COMET', 'ASTRONOMY', 'ORBIT', 'SOLAR', 'COSMIC']
    const p2 = buildWordSearchGrid(puzzle2Words, 12)

    const wordSearches: WordSearchPuzzle[] = [
      {
        puzzleNumber: 1,
        title: 'Forest Friends & Whispering Woods',
        theme: 'Nature & Storybook Animals',
        gridSize: 12,
        grid: p1.grid,
        wordList: p1.placedWords,
        hiddenFact: 'Hedgehogs have between 5,000 and 7,000 quills on their backs!',
      },
      {
        puzzleNumber: 2,
        title: 'Cosmic Constellations & Starlight',
        theme: 'Deep Space & Stars',
        gridSize: 12,
        grid: p2.grid,
        wordList: p2.placedWords,
        hiddenFact: 'A ray of starlight from the nearest star takes over 4 years to reach Earth.',
      },
    ]

    const crosswords: CrosswordPuzzle[] = [
      {
        puzzleNumber: 1,
        title: 'Storybook Lore Crossword',
        across: [
          { num: 1, clue: 'Animal with round ears that hibernates in winter', answer: 'BEAR' },
          { num: 3, clue: 'Bright celestial body that twinkles in the dark', answer: 'STAR' },
          { num: 5, clue: 'Small mammal covered in defensive prickles', answer: 'HEDGEHOG' },
        ],
        down: [
          { num: 2, clue: 'Natural canopy of trees and green foliage', answer: 'FOREST' },
          { num: 4, clue: 'Four-leaf green plant associated with luck', answer: 'CLOVER' },
        ],
      },
    ]

    return { type: 'word_game', wordSearches, crosswords }
  }

  if (bookType === 'novel_chapter') {
    const chapters: ChapterItem[] = [
      {
        chapterNumber: 1,
        title: 'The Brass Key and the Rising Mist',
        summary: 'Alden opens his grandfather clock shop on the Venice canal and uncovers an antique chronometer ticking backwards.',
        sceneGoal: 'Establish the historical mystery and the impending flood threat.',
        setting: 'Canal Grande, Venice, 1892',
        characters: ['Alden Vance', 'Signora Bellini'],
        status: 'completed',
        wordCount: 1120,
        content: `The fog over the Rio dei Mendicanti tasted of salt and extinguished coal.

Alden Vance kept his thumb pressed against the brass escapement of the mantel clock until the brass bit into his skin. If he let go, the hairspring would uncoil, and another century of Swiss precision would scatter across the green felt of his workbench.

"A gentleman does not open shop before the bells of San Marco," a voice called from the doorway.

Alden looked up through his jeweler’s loupe. The silhouette standing against the morning haze was slender, wrapped in an oilskin coat that smelled of wet wool and canal water.

"A gentleman in Venice," Alden murmured, releasing the spring with a millimeter’s clearance, "is usually drowning or borrowing money. Which are you today, Inspector?"

The woman stepped inside. She was no inspector. Her collar bore the brass gear pin of the Accademia di Meccanica—a guild Alden had been expelled from seven winters ago.

She placed a heavy velvet pouch onto the counter between them. Inside, something heavy was vibrating—not with the clean, measured tick of clockwork, but with the rapid, frantic flutter of a hummingbird's wing.

"It was pulled from the lagoon at dawn," she said. "The diver died twenty minutes later. His lungs weren't filled with water, Vance. They were filled with mercury."`,
      },
      {
        chapterNumber: 2,
        title: 'The Guild of the Submerged Bell',
        summary: 'Alden and the mysterious cartographer decode the alchemical markings inscribed upon the casing.',
        sceneGoal: 'Reveal the secret map hidden inside the mechanism.',
        setting: 'The submerged basement of the clockmaker atelier',
        characters: ['Alden Vance', 'Elaria Morosini'],
        status: 'draft',
        wordCount: 0,
        content: '',
      },
      {
        chapterNumber: 3,
        title: 'Venice Under the Lanterns',
        summary: 'A midnight gondola pursuit through the shadowy side canals leads them to the flooded crypt of San Zaccaria.',
        sceneGoal: 'High tension escape from the automaton patrols.',
        setting: 'San Zaccaria Flooded Crypt',
        status: 'draft',
        wordCount: 0,
        content: '',
      },
      {
        chapterNumber: 4,
        title: 'The Alchemist’s Great Engine',
        summary: 'Inside the sunken forge, the true scale of the tidal automaton machine is uncovered.',
        sceneGoal: 'Confrontation with the antagonist and discovery of the city’s impending doom.',
        setting: 'The Sunken Forge beneath the Arsenal',
        status: 'draft',
        wordCount: 0,
        content: '',
      },
    ]

    const novel: NovelContent = {
      premise: promptConcept,
      logline: `A disgraced Venetian clockmaker and a rogue guild cartographer race against an alchemical tidal engine set to plunge 1892 Venice into the sea.`,
      protagonist: 'Alden Vance, master clockmaker and former exile',
      antagonistOrConflict: 'The High Council of the Submerged Bell & the Alchemical Tidal Engine',
      targetWordCount: 45000,
      chapters,
    }

    return { type: 'novel_chapter', novel }
  }

  // Short Story fallback
  const story: ShortStoryContent = {
    title: title || 'The Lighthouse Keeper’s Star',
    synopsis: promptConcept,
    theme: 'Hope, memory, and the enduring guidance of light',
    wordCount: 1450,
    readingTimeMinutes: 6,
    storyText: `The sea never forgot what it swallowed, but old Silas had begun to forget his own name.

Every evening at quarter past six, his boots scraped against the spiral granite steps of the Cape Fortune beacon. One hundred and eighty-four steps. Forty-two brass rivets along the banister. These were the things that did not change when the world beyond the tide grew strange.

Tonight, the wind smelled of ozone and crushed shells. Silas reached the lantern room, wiped the salt mist from the curved glass with his flannel rag, and looked out.

There was no ship upon the shoal. Instead, floating ten feet above the foam, was a light that didn't sweep. It hovered—steady, amber, breathing like an ember caught in chimney draft.

Silas stopped his rag. He had tended this kerosene burner for fifty-two years. He knew the red blink of the harbor buoy, the sweep of the naval cutter, the blue phosphorescence of dying jellyfish. This was none of them.

It began to sing. Not in words, but in the low, resonant hum of an iron bell struck underwater.

Silas reached into his pocket and withdrew the silver locket his daughter had left behind when the influenza took the lower village in the hard winter of '18. As the amber light pulsed, the frozen silver in his hand grew warm.

"You're late," Silas whispered into the salt air, tears carving clean paths down his weathered cheeks.

The light dipped in greeting, and across forty miles of dark Atlantic water, every lantern in the bay ignited at once.`,
  }

  return { type: 'short_story', story }
}

/**
 * House style every generator shares. Kept in one place so the voice does not
 * drift between book types.
 */
const BASE_SYSTEM = `You are a working author and book producer. You write finished pages, not pitches.

Rules you never break:
- Write the actual content. Never describe what you would write, never leave placeholders or "[insert here]".
- No meta commentary, no notes to the reader, no restating the brief back.
- Plain, concrete language. Cut "magical", "whimsical", "captivating", "journey", "tapestry", "delve".
- Stay consistent: the same character has the same name, age and appearance on every page.
- Honour the requested count exactly. If asked for 8 pages, produce 8.`

const TYPE_SYSTEM: Record<BookTypeKey, string> = {
  children: `${BASE_SYSTEM}
- Vocabulary and sentence length must suit the stated age band, read aloud in one sitting.
- Give the story a want, an obstacle and a resolution. Not a list of pleasant scenes.
- Every illustrationPrompt must stand alone: restate the character's species, colour, clothing and the setting each time, because each page is drawn without sight of the others.`,

  coloring: `${BASE_SYSTEM}
- These pages are printed and coloured in by hand. Every lineArtPrompt must demand pure black outlines on pure white, closed shapes, no shading, no gradients, no gray fill, no photographic background.
- Match detailLevel to the audience: "simple" means thick lines and large areas for small children; "intricate" means dense pattern work for adults.
- Vary the subjects across pages. Do not produce five variations of one scene.`,

  word_game: `${BASE_SYSTEM}
- Words must be real, spelled correctly, and genuinely on theme.
- Supply letters only — no spaces, hyphens, plurals-of-convenience or proper nouns unless the theme is names.
- Crossword answers must be words the clue actually defines. A clue that does not resolve to its answer is a defect.
- hiddenFact must be true and checkable.`,

  novel_chapter: `${BASE_SYSTEM}
- Build a real dramatic structure: escalating complications, a midpoint reversal, a climax that pays off the premise.
- Each chapter summary states what actually happens and what changes, not what the reader will feel.
- Chapter titles evoke; summaries inform. Do not write the same sentence twice in different words.`,

  short_story: `${BASE_SYSTEM}
- Deliver a complete story with a beginning, a turn and an ending. Not an excerpt or a first chapter.
- Open in the middle of something happening. Close on a change, not a summary of the theme.`,
}

function buildPrompt(input: CreateBookProjectInput): string {
  const countLabel = input.bookType === 'novel_chapter' ? 'chapters' : 'pages/puzzles'
  return [
    `Title: ${input.title}`,
    input.subtitle ? `Subtitle: ${input.subtitle}` : null,
    `Concept the publisher gave you: ${input.promptConcept}`,
    input.genre ? `Genre: ${input.genre}` : null,
    `Intended reader: ${input.targetAudience || 'general audience'}`,
    `Visual and narrative style: ${input.styleTheme || 'classic'}`,
    input.difficultyLevel ? `Difficulty: ${input.difficultyLevel}` : null,
    `Produce exactly ${input.pageCount ?? 8} ${countLabel}.`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** The model supplies word lists; the letter matrix is built here, deterministically. */
function materializeWordGame(draft: WordGameDraft): GeneratedBookContent {
  const wordSearches: WordSearchPuzzle[] = draft.wordSearches.map((ws, idx) => {
    const { grid, placedWords } = buildWordSearchGrid(ws.words, ws.gridSize)
    return {
      puzzleNumber: idx + 1,
      title: ws.title,
      theme: ws.theme,
      gridSize: ws.gridSize,
      grid,
      wordList: placedWords,
      hiddenFact: ws.hiddenFact,
    }
  })

  const crosswords: CrosswordPuzzle[] | undefined = draft.crosswords?.map((cw, idx) => ({
    ...cw,
    puzzleNumber: idx + 1,
  }))

  return { type: 'word_game', wordSearches, crosswords }
}

/**
 * Generates a project's content. The caller must check `source`: on 'fallback'
 * the publisher is looking at stock sample content, not their concept.
 */
export async function generateBookProjectContent(
  input: CreateBookProjectInput,
  credentials?: AiCredentials
): Promise<AiResult<GeneratedBookContent>> {
  const bookType = input.bookType

  const result = await generateStructured({
    label: `create-book:${bookType}`,
    // Each entry validates exactly its own branch; the cast only tells the
    // compiler that the lookup can produce any of them.
    schema: CONTENT_SCHEMAS[bookType] as ZodType<BookContentDraft | null>,
    system: TYPE_SYSTEM[bookType],
    prompt: buildPrompt(input),
    credentials,
    temperature: 0.8,
    // Whole-book generation is the longest call in the app; the old 12s ceiling
    // meant almost every request quietly served the sample book instead.
    timeoutMs: 120_000,
    fallback: () => null,
  })

  if (result.source === 'fallback' || !result.data) {
    return { data: sampleBookContent(input), source: 'fallback', reason: result.reason }
  }

  const draft = result.data
  if (draft.type === 'word_game') {
    return { data: materializeWordGame(draft), source: 'ai' }
  }

  // Outlines arrive without prose; chapters are written one at a time on demand.
  if (draft.type === 'novel_chapter') {
    return {
      data: {
        type: 'novel_chapter',
        novel: {
          ...draft.novel,
          chapters: draft.novel.chapters.map((c) => ({ ...c, status: 'draft' as const, content: '', wordCount: 0 })),
        },
      },
      source: 'ai',
    }
  }

  if (draft.type === 'short_story') {
    const wordCount = countWords(draft.story.storyText)
    return {
      data: {
        type: 'short_story',
        story: { ...draft.story, wordCount, readingTimeMinutes: Math.max(1, Math.round(wordCount / 230)) },
      },
      source: 'ai',
    }
  }

  return { data: draft, source: 'ai' }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export interface ChapterRequest {
  bookTitle: string
  premise: string
  chapterNumber: number
  chapterTitle: string
  chapterSummary: string
  previousChapterSummary?: string
  styleTheme: string
}

const CHAPTER_SYSTEM = `${BASE_SYSTEM}
- Write the chapter as it will appear in the finished book: scene, dialogue, interiority, movement.
- 900 to 1500 words. Start in the scene, not with weather or waking up.
- End on a turn or an unanswered question, never on a summary of what just happened.
- Do not output the chapter number or title; the book supplies those.`

function sampleChapter(params: ChapterRequest): string {
  return [
    params.chapterSummary,
    '',
    'The room had the particular stillness of a place where something was about to be decided.',
    '',
    'This chapter has not been written yet — add an AI key in Settings to draft it, or write over this text directly.',
  ].join('\n')
}

export async function generateIndividualChapter(
  params: ChapterRequest,
  credentials?: AiCredentials
): Promise<AiResult<{ content: string; wordCount: number }>> {
  const result = await generateStructured({
    label: 'create-book:chapter',
    schema: chapterProseSchema,
    system: CHAPTER_SYSTEM,
    prompt: [
      `Book: ${params.bookTitle}`,
      `Premise: ${params.premise}`,
      `Voice and style: ${params.styleTheme}`,
      `Chapter ${params.chapterNumber}: ${params.chapterTitle}`,
      `What must happen in it: ${params.chapterSummary}`,
      params.previousChapterSummary ? `Where the previous chapter left off: ${params.previousChapterSummary}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    credentials,
    temperature: 0.85,
    timeoutMs: 90_000,
    fallback: () => ({ content: sampleChapter(params) }),
  })

  return { ...result, data: { content: result.data.content.trim(), wordCount: countWords(result.data.content) } }
}
