'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff, Lightbulb, Puzzle, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import type { WordSearchPuzzle, CrosswordPuzzle } from '@/lib/services/creator/types'

export function WordGameViewer({
  wordSearches,
  crosswords = [],
}: {
  wordSearches: WordSearchPuzzle[]
  crosswords?: CrosswordPuzzle[]
}) {
  const [activeSearchIdx, setActiveSearchIdx] = useState(0)
  const [showAnswers, setShowAnswers] = useState(false)
  const [foundWords, setFoundWords] = useState<Record<string, boolean>>({})

  const puzzle = wordSearches[activeSearchIdx]

  function toggleWord(word: string) {
    setFoundWords((prev) => ({
      ...prev,
      [word]: !prev[word],
    }))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Selector between Word Searches */}
      {wordSearches.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {wordSearches.map((ws, idx) => (
            <button
              key={ws.puzzleNumber}
              type="button"
              onClick={() => {
                setActiveSearchIdx(idx)
                setFoundWords({})
              }}
              className={cn(
                'rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all',
                activeSearchIdx === idx
                  ? 'border-accent bg-accent text-on-accent shadow-subtle'
                  : 'border-line bg-surface text-ink hover:border-accent/40'
              )}
            >
              Puzzle #{ws.puzzleNumber}: {ws.title}
            </button>
          ))}
        </div>
      )}

      {/* Main Word Search Layout */}
      {puzzle && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: The Letter Grid (7 cols) */}
          <Card className="p-6 lg:col-span-7">
            <div className="flex items-center justify-between">
              <div>
                <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                  Word Search #{puzzle.puzzleNumber}
                </span>
                <h3 className="mt-2 text-lg font-bold text-ink">{puzzle.title}</h3>
                <p className="text-xs text-ink-muted">Theme: {puzzle.theme}</p>
              </div>

              <span className="font-mono text-xs font-medium text-ink-muted">
                {puzzle.gridSize}×{puzzle.gridSize} Grid
              </span>
            </div>

            {/* Matrix Render */}
            <div className="mt-6 flex justify-center overflow-x-auto py-2">
              <div
                className="inline-grid gap-1 rounded-2xl border border-line/80 bg-surface-2/60 p-3 shadow-inset"
                style={{
                  gridTemplateColumns: `repeat(${puzzle.gridSize}, minmax(0, 1fr))`,
                }}
              >
                {puzzle.grid.map((row, rIdx) =>
                  row.map((char, cIdx) => (
                    <span
                      key={`${rIdx}-${cIdx}`}
                      className="grid size-7 sm:size-8 place-items-center rounded-lg bg-surface font-mono text-xs font-bold text-ink shadow-subtle hover:bg-accent-soft hover:text-accent transition-colors select-none"
                    >
                      {char}
                    </span>
                  ))
                )}
              </div>
            </div>

            {puzzle.hiddenFact && (
              <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-ink-muted">
                <Lightbulb className="size-4 shrink-0 text-amber-500" />
                <span>
                  <strong className="text-ink">Fun Fact: </strong>
                  {puzzle.hiddenFact}
                </span>
              </div>
            )}
          </Card>

          {/* Right: Word Bank & Progress (5 cols) */}
          <Card className="flex flex-col justify-between p-6 bg-surface-2/40 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink">
                  <Puzzle className="size-4 text-accent" /> Word Bank ({puzzle.wordList.length} words)
                </span>
                <span className="text-xs font-mono text-ink-muted">
                  {Object.values(foundWords).filter(Boolean).length} found
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Click a word to cross it off as you find it in the grid:
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {puzzle.wordList.map((word) => {
                  const isChecked = Boolean(foundWords[word])
                  return (
                    <button
                      key={word}
                      type="button"
                      onClick={() => toggleWord(word)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all',
                        isChecked
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 line-through dark:text-emerald-400'
                          : 'border-line bg-surface font-bold text-ink hover:border-accent/50'
                      )}
                    >
                      {isChecked && <Check className="size-3 text-emerald-500" />}
                      {word}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-6 border-t border-line/60 pt-4 text-xs text-ink-muted">
              Ready for export into Amazon KDP Activity Books (6×9" or 8.5×11").
            </div>
          </Card>
        </div>
      )}

      {/* Crossword Section if available */}
      {crosswords.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                Bonus Crossword
              </span>
              <h4 className="mt-2 text-base font-bold text-ink">{crosswords[0].title}</h4>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAnswers((prev) => !prev)}
            >
              {showAnswers ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showAnswers ? 'Hide Answers' : 'Reveal Answers'}
            </Button>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-accent">Across Clues</h5>
              <ul className="mt-2 space-y-2 text-xs text-ink">
                {crosswords[0].across.map((c) => (
                  <li key={`across-${c.num}`} className="flex items-start gap-2">
                    <span className="font-bold text-ink-muted">{c.num}.</span>
                    <span className="flex-1">{c.clue}</span>
                    {showAnswers && (
                      <span className="font-mono font-bold text-accent">[{c.answer}]</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-accent">Down Clues</h5>
              <ul className="mt-2 space-y-2 text-xs text-ink">
                {crosswords[0].down.map((c) => (
                  <li key={`down-${c.num}`} className="flex items-start gap-2">
                    <span className="font-bold text-ink-muted">{c.num}.</span>
                    <span className="flex-1">{c.clue}</span>
                    {showAnswers && (
                      <span className="font-mono font-bold text-accent">[{c.answer}]</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
