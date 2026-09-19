import { z } from 'zod'

export type BookTypeKey = 'children' | 'coloring' | 'word_game' | 'novel_chapter' | 'short_story'

export interface BookTypeDefinition {
  key: BookTypeKey
  title: string
  subtitle: string
  badge: string
  description: string
  tags: string[]
  defaultPages: number
  icon: string
}

export const BOOK_TYPES: BookTypeDefinition[] = [
  {
    key: 'children',
    title: "Children's Story Book",
    subtitle: 'Illustrated pages with narrative spreads',
    badge: 'Illustrated Story',
    description: 'Create heartwarming picture books with page-by-page storytelling, rhyming or prose, and AI illustration prompts.',
    tags: ['Picture Book', 'Bedtime Stories', 'Illustration Prompts', 'Spread Layout'],
    defaultPages: 8,
    icon: 'baby',
  },
  {
    key: 'coloring',
    title: 'Coloring Book & Pages',
    subtitle: 'Crisp black & white line art spreads',
    badge: 'KDP Bestseller',
    description: 'Generate themed coloring books with clean vector outlines, high contrast borders, and printable artwork for kids or adults.',
    tags: ['Coloring Sheets', 'Bold Outlines', 'Mandalas & Patterns', 'KDP Ready'],
    defaultPages: 10,
    icon: 'palette',
  },
  {
    key: 'word_game',
    title: 'Word Games & Puzzle Book',
    subtitle: 'Word searches, crosswords & scrambles',
    badge: 'Activity Book',
    description: 'Create playable word searches with real letter grids, crossword clues & solutions, and vocabulary brain teasers.',
    tags: ['Word Search Grid', 'Crosswords', 'Answer Keys', 'Brain Games'],
    defaultPages: 6,
    icon: 'puzzle',
  },
  {
    key: 'novel_chapter',
    title: 'Novel (Chapter by Chapter)',
    subtitle: 'Full book outline & sequential writing',
    badge: 'Deep Writing',
    description: 'Build a complete novel or non-fiction guide from a high-level premise, generate the chapter outline, and write chapters sequentially.',
    tags: ['Full Outline', 'Chapter Generation', 'Continuous Context', 'Manuscript Export'],
    defaultPages: 10,
    icon: 'book-open',
  },
  {
    key: 'short_story',
    title: 'Short Story & Novella',
    subtitle: 'Compelling standalone narrative',
    badge: 'Fiction',
    description: 'Generate rich, atmospheric short fiction with deep characters, dialogue pacing, and unforgettable twist endings.',
    tags: ['Complete Story', 'Fiction & Drama', 'Fast Turnaround'],
    defaultPages: 1,
    icon: 'feather',
  },
]

export interface StyleOption {
  key: string
  label: string
  description: string
  samplePromptSnippet: string
}

export const STYLES_BY_TYPE: Record<BookTypeKey, StyleOption[]> = {
  children: [
    {
      key: 'watercolor',
      label: 'Watercolor Whimsical',
      description: 'Soft pastel watercolor with dreamy washes, warm starlight, and gentle fairytale tones',
      samplePromptSnippet: 'soft whimsical watercolor children book illustration, gentle pastel colors, storybook lighting',
    },
    {
      key: 'pixar_3d',
      label: '3D Animation Style',
      description: 'Vibrant, cinematic 3D character design reminiscent of modern animated features',
      samplePromptSnippet: 'vibrant 3D animated movie style, expressive cute character, cinematic volumetric lighting',
    },
    {
      key: 'digital_vector',
      label: 'Vibrant Flat Vector',
      description: 'Clean, cheerful flat vector art with bold shapes, bright cheerful colors, and high legibility',
      samplePromptSnippet: 'clean modern flat vector illustration for kids, bold saturated colors, cheerful shapes',
    },
    {
      key: 'classic_storybook',
      label: 'Classic Heritage Ink & Wash',
      description: 'Timeless vintage English countryside storybook aesthetic with delicate pen lines',
      samplePromptSnippet: 'classic vintage English storybook illustration, delicate ink outlines with warm watercolor wash',
    },
    {
      key: 'crayon_sketch',
      label: 'Playful Crayon & Gouache',
      description: 'Charming textured crayon strokes, bold primary colors, and tactile handcrafted warmth',
      samplePromptSnippet: 'charming colored pencil and gouache illustration for children, paper texture, playful energy',
    },
  ],
  coloring: [
    {
      key: 'bold_kids',
      label: 'Bold Lines for Kids (Ages 3-8)',
      description: 'Extra-thick outlines with wide open coloring areas, friendly smiling characters, zero tiny details',
      samplePromptSnippet: 'clean black and white coloring page for young kids, thick bold black outlines, simple shapes, white background, no shading, no grayscale',
    },
    {
      key: 'intricate_mandala',
      label: 'Intricate Patterns & Mandalas',
      description: 'Geometric symmetry, calming repeating motifs, and detailed mindfulness line art for adults',
      samplePromptSnippet: 'intricate black and white mandala coloring page, symmetrical ornate patterns, fine clean outlines, pure white background, no gradients',
    },
    {
      key: 'botanical_nature',
      label: 'Botanical Florals & Wildlife',
      description: 'Lush flowers, forest animals, woodland vines, and natural fauna with balanced outline depth',
      samplePromptSnippet: 'black and white botanical coloring book page, detailed flora and fauna, crisp clean vector lines, adult coloring style, no gray fills',
    },
    {
      key: 'fantasy_mythic',
      label: 'Fantasy & Mythic Creatures',
      description: 'Baby dragons, fairy kingdoms, magical unicorns, and enchanted castles with decorative borders',
      samplePromptSnippet: 'fantasy coloring book line art, mythical dragon and enchanted castle, clean contour lines, black and white lineart, sharp edges',
    },
    {
      key: 'kawaii_cute',
      label: 'Kawaii Chibi & Animals',
      description: 'Adorable oversized eyes, sweet treats, cute woodland pets, and cheerful cartoon aesthetic',
      samplePromptSnippet: 'cute kawaii coloring book page, adorable chibi animals, rounded bold black contours, simple fun coloring areas, clean white background',
    },
  ],
  word_game: [
    {
      key: 'word_search_themed',
      label: 'Themed Word Search (Grid & Word List)',
      description: 'Letters matrix grid with hidden themed words (horizontal, vertical, diagonal) plus answer keys',
      samplePromptSnippet: 'Word search puzzle with structured matrix and theme vocabulary',
    },
    {
      key: 'crossword_classic',
      label: 'Classic Mini Crossword',
      description: 'Intersecting clue cards with Across and Down definitions, numbered cells, and solution table',
      samplePromptSnippet: 'Mini crossword puzzle with clever literary and thematic clues',
    },
    {
      key: 'word_scramble',
      label: 'Word Scramble & Cryptogram',
      description: 'Jumbled mystery terms, letter-substitution ciphers, and trivia decoding challenges',
      samplePromptSnippet: 'Word scramble and decoding activity with solution guide',
    },
    {
      key: 'kids_vocab_hunt',
      label: 'Kids Picture Word Hunt',
      description: 'Simple 8x8 to 10x10 grids with beginner vocabulary, rhyming hints, and animal themes',
      samplePromptSnippet: 'Beginner word hunt puzzle designed for young learners',
    },
  ],
  novel_chapter: [
    {
      key: 'thriller_suspense',
      label: 'Psychological Thriller & Mystery',
      description: 'Taut cliffhangers, high stakes, unreliable narrators, and relentless chapter pacing',
      samplePromptSnippet: 'gripping psychological suspense, short punchy paragraphs, building tension, sharp dialogue',
    },
    {
      key: 'high_fantasy',
      label: 'Epic High Fantasy',
      description: 'Rich world-building, sensory magic systems, political intrigue, and expansive lore',
      samplePromptSnippet: 'epic fantasy narrative, atmospheric world-building, lyrical descriptions, heroic character depth',
    },
    {
      key: 'cozy_romance',
      label: 'Cozy Contemporary Romance',
      description: 'Sparkling banter, emotional vulnerability, dual POV tension, and heartwarming resolutions',
      samplePromptSnippet: 'warm contemporary romance, witty dialogue, genuine emotional chemistry, heartfelt prose',
    },
    {
      key: 'sci_fi_speculative',
      label: 'Speculative Sci-Fi & Cyberpunk',
      description: 'Thought-provoking technological concepts, neo-noir grit, and dystopian wonder',
      samplePromptSnippet: 'speculative science fiction, visceral technological atmosphere, thought-provoking premise',
    },
    {
      key: 'non_fiction_guide',
      label: 'Practical Non-Fiction & Guide',
      description: 'Clear action-oriented frameworks, compelling case stories, key takeaways, and structured sections',
      samplePromptSnippet: 'authoritative and engaging non-fiction, clear frameworks, relatable anecdotes, punchy takeaways',
    },
  ],
  short_story: [
    {
      key: 'literary_atmospheric',
      label: 'Literary & Evocative',
      description: 'Poetic cadence, psychological intimacy, and poignant emotional resonance',
      samplePromptSnippet: 'literary fiction, rich subtext, atmospheric sensory details, introspective voice',
    },
    {
      key: 'mystery_twist',
      label: 'Mystery with a Twist',
      description: 'Clever misdirection leading to a satisfying, unexpected final reveal',
      samplePromptSnippet: 'mystery flash fiction, intriguing setup, careful breadcrumbs, twist ending',
    },
    {
      key: 'bedtime_fable',
      label: 'Bedtime Fable & Allegory',
      description: 'Calming cadence, timeless wisdom, and soothing storybook closure',
      samplePromptSnippet: 'soothing fable style, warm gentle pacing, meaningful life lesson',
    },
  ],
}

export const TARGET_AUDIENCES = [
  { key: 'toddlers', label: 'Toddlers (Ages 2–4)' },
  { key: 'early_readers', label: 'Early Readers (Ages 5–7)' },
  { key: 'middle_grade', label: 'Middle Grade (Ages 8–12)' },
  { key: 'young_adult', label: 'Young Adult (Ages 13–18)' },
  { key: 'adults', label: 'Adults' },
  { key: 'all_ages', label: 'All Ages & Family' },
] as const

export const INSPIRATION_TEMPLATES = [
  {
    bookType: 'children' as BookTypeKey,
    title: 'The Little Bear Who Caught a Falling Star',
    concept: 'A curious bear cub named Barnaby discovers that a fallen star lost its glow in the Whispering Woods, and with the help of a wise hedgehog, learns how sharing warmth restores the light.',
    styleTheme: 'watercolor',
    targetAudience: 'early_readers',
  },
  {
    bookType: 'coloring' as BookTypeKey,
    title: 'Enchanted Forest & Woodland Friends',
    concept: 'A 10-page coloring journey featuring cozy animal cottages, baby foxes sleeping in giant mushrooms, tea-drinking badgers, and decorative floral borders.',
    styleTheme: 'bold_kids',
    targetAudience: 'early_readers',
  },
  {
    bookType: 'word_game' as BookTypeKey,
    title: 'Ocean Deep Word Search & Marine Adventures',
    concept: 'Engaging maritime word search puzzles covering coral reefs, deep sea submarines, legendary shipwrecks, and arctic marine mammals with full solution keys.',
    styleTheme: 'word_search_themed',
    targetAudience: 'middle_grade',
  },
  {
    bookType: 'novel_chapter' as BookTypeKey,
    title: 'The Clockwork Alchemist of Venice',
    concept: 'In 1892 Venice, a disgraced watchmaker unravels an automaton conspiracy that threatens to flood the city, forcing him to team up with a mysterious guild cartographer.',
    styleTheme: 'thriller_suspense',
    targetAudience: 'adults',
  },
  {
    bookType: 'coloring' as BookTypeKey,
    title: 'Mythic Beasts & Celestial Dragons',
    concept: 'High-detail black and white coloring illustrations of celestial eastern dragons, solar phoenixes, and celestial constellations for mindful relaxation.',
    styleTheme: 'intricate_mandala',
    targetAudience: 'adults',
  },
]

export const createBookProjectSchema = z.object({
  title: z.string().trim().min(1, 'Please enter a title for your book'),
  subtitle: z.string().trim().optional(),
  author: z.string().trim().optional(),
  bookType: z.enum(['children', 'coloring', 'word_game', 'novel_chapter', 'short_story']),
  genre: z.string().trim().optional(),
  targetAudience: z.string().trim().default('all_ages'),
  styleTheme: z.string().trim().default('watercolor'),
  difficultyLevel: z.enum(['easy', 'medium', 'hard']).optional(),
  promptConcept: z.string().trim().min(10, 'Please provide a brief story or book concept (at least 10 characters)'),
  pageCount: z.number().int().min(1).max(30).default(8),
})

export type CreateBookProjectInput = z.infer<typeof createBookProjectSchema>
