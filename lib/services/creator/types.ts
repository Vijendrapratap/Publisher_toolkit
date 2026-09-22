import type { BookTypeKey } from './options'

export interface StoryPage {
  pageNumber: number
  spreadHeading?: string
  storyText: string
  rhymePattern?: string
  illustrationPrompt: string
  characterFocus?: string
  generatedImageUrl?: string
}

export interface ColoringPage {
  pageNumber: number
  title: string
  sceneDescription: string
  lineArtPrompt: string
  detailLevel: 'simple' | 'moderate' | 'intricate'
  generatedImageUrl?: string
}

export interface WordSearchPuzzle {
  puzzleNumber: number
  title: string
  theme: string
  gridSize: number
  grid: string[][]
  wordList: string[]
  hiddenFact?: string
  illustrationPrompt?: string
  illustrationUrl?: string
}

export interface CrosswordClue {
  num: number
  clue: string
  answer: string
}

export interface CrosswordPuzzle {
  puzzleNumber: number
  title: string
  across: CrosswordClue[]
  down: CrosswordClue[]
  illustrationUrl?: string
}

export interface ChapterItem {
  chapterNumber: number
  title: string
  summary: string
  sceneGoal?: string
  setting?: string
  characters?: string[]
  status: 'draft' | 'generating' | 'completed'
  content: string
  wordCount: number
  illustrationUrl?: string
}

export interface NovelContent {
  premise: string
  logline: string
  protagonist: string
  antagonistOrConflict: string
  targetWordCount?: number
  chapters: ChapterItem[]
}

export interface ShortStoryContent {
  title: string
  synopsis: string
  theme: string
  storyText: string
  wordCount: number
  readingTimeMinutes: number
  illustrationPrompt?: string
  illustrationUrl?: string
}

export type GeneratedBookContent =
  | { type: 'children'; pages: StoryPage[] }
  | { type: 'coloring'; pages: ColoringPage[] }
  | { type: 'word_game'; wordSearches: WordSearchPuzzle[]; crosswords?: CrosswordPuzzle[] }
  | { type: 'novel_chapter'; novel: NovelContent }
  | { type: 'short_story'; story: ShortStoryContent }

export interface BookCreatorProjectData {
  id: string
  publisherId: string
  title: string | null
  subtitle: string | null
  author: string | null
  bookType: BookTypeKey
  genre: string | null
  targetAudience: string | null
  styleTheme: string | null
  difficultyLevel: string | null
  promptConcept: string | null
  coverPrompt: string | null
  coverImageUrl: string | null
  status: string
  metadata: Record<string, any> | null
  content: GeneratedBookContent | null
  wordCount: number
  pageCount: number
  createdAt: Date | string
  updatedAt: Date | string
}
