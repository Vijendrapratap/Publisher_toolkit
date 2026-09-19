import { generateText } from 'ai'
import { isAiConfigured, getProcessingModel } from '@/lib/providers/ai'
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
import type { CreateBookProjectInput } from './options'

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
 * Main AI generation entrypoint
 */
export async function generateBookProjectContent(
  input: CreateBookProjectInput
): Promise<GeneratedBookContent> {
  if (!isAiConfigured()) {
    return sampleBookContent(input)
  }

  try {
    const model = getProcessingModel()
    const prompt = `You are a world-class book author, children's book writer, and creative editor.
Generate a complete structured project for a book of type: "${input.bookType}".

Title: "${input.title}"
Concept/Premise: "${input.promptConcept}"
Target Audience: "${input.targetAudience}"
Visual/Narrative Style: "${input.styleTheme}"
Target page/chapter count: ${input.pageCount}

Return a valid JSON object matching the book type:
- If children: { "type": "children", "pages": [{ "pageNumber": 1, "spreadHeading": "...", "storyText": "...", "illustrationPrompt": "...", "characterFocus": "..." }] }
- If coloring: { "type": "coloring", "pages": [{ "pageNumber": 1, "title": "...", "sceneDescription": "...", "lineArtPrompt": "...", "detailLevel": "simple"|"moderate"|"intricate" }] }
- If word_game: { "type": "word_game", "wordSearches": [{ "puzzleNumber": 1, "title": "...", "theme": "...", "gridSize": 12, "words": ["WORD1", "WORD2", ...], "hiddenFact": "..." }] }
- If novel_chapter: { "type": "novel_chapter", "novel": { "premise": "...", "logline": "...", "protagonist": "...", "antagonistOrConflict": "...", "chapters": [{ "chapterNumber": 1, "title": "...", "summary": "...", "sceneGoal": "...", "status": "completed", "content": "Full chapter opening text...", "wordCount": 800 }] } }
- If short_story: { "type": "short_story", "story": { "title": "...", "synopsis": "...", "theme": "...", "storyText": "...", "wordCount": 1200, "readingTimeMinutes": 5 } }

Return strictly pure JSON with zero markdown code fences.`

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(12000),
    })

    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(cleaned)

    // For word searches, build the matrix grids if not provided
    if (parsed.type === 'word_game' && Array.isArray(parsed.wordSearches)) {
      parsed.wordSearches = parsed.wordSearches.map((ws: any, idx: number) => {
        const words = ws.words || ws.wordList || ['PUZZLE', 'STORY', 'BOOK', 'WORDS']
        const { grid, placedWords } = buildWordSearchGrid(words, ws.gridSize || 12)
        return {
          puzzleNumber: idx + 1,
          title: ws.title || `Word Search #${idx + 1}`,
          theme: ws.theme || input.title,
          gridSize: ws.gridSize || 12,
          grid,
          wordList: placedWords,
          hiddenFact: ws.hiddenFact,
        }
      })
    }

    return parsed as GeneratedBookContent
  } catch (err) {
    console.warn('AI book generation failed or returned invalid JSON. Falling back to deterministic generator:', err)
    return sampleBookContent(input)
  }
}

/**
 * Generates an individual chapter in chapter-by-chapter mode
 */
export async function generateIndividualChapter(params: {
  bookTitle: string
  premise: string
  chapterNumber: number
  chapterTitle: string
  chapterSummary: string
  previousChapterSummary?: string
  styleTheme: string
}): Promise<{ content: string; wordCount: number }> {
  if (!isAiConfigured()) {
    const content = `Chapter ${params.chapterNumber}: ${params.chapterTitle}

The shadows in the grand hall lengthened as twilight settled over the city.

Alden leaned over the mahogany drafting table, his hands steady despite the cold drafting through the tall sash windows. The parchment before him bore the faint watermark of the Venetian Cartographers Guild, three centuries old and brittle as dried cedar.

"You understand what happens if we are discovered here," Elaria murmured, her eyes fixed on the canal below. The lantern on the prow of the passing patrol barge cast undulating ribs of amber across the vaulted ceiling.

"We have twenty minutes until the tide shifts," Alden replied without looking up. He traced the fine copper ink lines representing the subterranean conduits. "If the alchemical lock aligns with the full moon tonight, the sluice gates will open from within. There won't be a patrol left to worry about."

Outside, the bells of the campanile tolled nine. With each stroke, the copper apparatus tucked inside Alden’s waistcoat gave a faint, sympathetic chime, resonating with the deep brass vibration of the city.`
    const words = content.split(/\s+/).length
    return { content, wordCount: words }
  }

  try {
    const model = getProcessingModel()
    const prompt = `You are a master fiction author. Write the full text for Chapter ${params.chapterNumber} of the book "${params.bookTitle}".

Premise: ${params.premise}
Style / Voice: ${params.styleTheme}
Chapter Title: ${params.chapterTitle}
Chapter Goal & Summary: ${params.chapterSummary}
${params.previousChapterSummary ? `Context from Previous Chapter: ${params.previousChapterSummary}` : ''}

Instructions:
- Write engaging, immersive narrative prose with sensory descriptions, authentic character dialogue, and dramatic pacing.
- Length: 800 to 1400 words.
- Advance the scene goal and end on a natural beat or cliffhanger.
- Do NOT include any meta commentary, notes, or chapter numbers in your output. Just write the story directly.`

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(12000),
    })

    const trimmed = text.trim()
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length
    return { content: trimmed, wordCount }
  } catch (err) {
    console.warn('Failed to generate individual chapter with AI, using fallback:', err)
    const fallback = `Chapter ${params.chapterNumber}: ${params.chapterTitle}\n\nThe cold wind carried the scent of rain as night settled in. ${params.chapterSummary}`
    return { content: fallback, wordCount: fallback.split(/\s+/).length }
  }
}
