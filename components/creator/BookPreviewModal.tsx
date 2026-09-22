'use client'

import { useState, useEffect } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  BookOpen,
  Sparkles,
  Palette,
  Puzzle,
  Feather,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import type { BookCreatorProjectData } from '@/lib/services/creator/types'

export function BookPreviewModal({
  project,
  isOpen,
  onClose,
}: {
  project: BookCreatorProjectData
  isOpen: boolean
  onClose: () => void
}) {
  const [pageIndex, setPageIndex] = useState(0) // 0 = Cover, 1..N = Content pages

  // Calculate total pages
  const content = project.content
  let totalInteriorPages = 0
  if (content) {
    if (content.type === 'children' || content.type === 'coloring') {
      totalInteriorPages = content.pages.length
    } else if (content.type === 'word_game') {
      totalInteriorPages = content.wordSearches.length
    } else if (content.type === 'short_story') {
      totalInteriorPages = 1
    } else if (content.type === 'novel_chapter') {
      totalInteriorPages = content.novel.chapters.length
    }
  }

  const totalSteps = totalInteriorPages + 1 // +1 for Cover

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') setPageIndex((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setPageIndex((p) => Math.min(totalSteps - 1, p + 1))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, totalSteps, onClose])

  if (!isOpen) return null

  const isCover = pageIndex === 0
  const activeInteriorIdx = pageIndex - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book Preview"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative flex flex-col h-full max-h-[92vh] w-full max-w-5xl rounded-3xl border border-line/40 bg-surface shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-surface-2/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="size-4 text-accent shrink-0" />
            <span className="font-display font-bold text-sm text-ink truncate">
              {project.title || 'Untitled Book'}
            </span>
            <span className="text-xs text-line">•</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent shrink-0">
              {isCover ? 'Front Cover' : `Page ${activeInteriorIdx + 1} of ${totalInteriorPages}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/creator/projects/${project.id}/pdf`}
              download
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-subtle hover:border-accent transition-colors"
            >
              <Download className="size-3.5 text-accent" /> Download PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-xl text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
              aria-label="Close Preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Modal Body / Book Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center bg-ink/5">
          {isCover ? (
            /* ========================================== */
            /* REALISTIC HARDCOVER FRONT COVER PRESENTATION */
            /* ========================================== */
            <div className="relative flex flex-col items-center justify-between aspect-[3/4] w-full max-w-md rounded-2xl border-4 border-amber-950/20 bg-surface p-6 shadow-2xl overflow-hidden text-center transition-all duration-300">
              {/* Spine highlight on the left edge */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/25 via-black/5 to-transparent" />
              {/* Gloss highlight across top */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/20 to-transparent" />

              {/* Cover Header */}
              <div className="relative z-10 w-full pt-2">
                <span className="rounded-full bg-accent/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent">
                  {project.bookType.toUpperCase().replace('_', ' ')}
                </span>
                <h1 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink leading-tight">
                  {project.title || 'Untitled Book'}
                </h1>
                {project.subtitle && (
                  <p className="mt-1 font-serif text-xs sm:text-sm text-ink-muted italic">
                    {project.subtitle}
                  </p>
                )}
              </div>

              {/* Front Cover Artwork */}
              <div className="relative z-10 my-4 flex-1 w-full overflow-hidden rounded-xl border border-line bg-surface-2 flex items-center justify-center shadow-inner">
                {project.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.coverImageUrl}
                    alt="Front Cover Art"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-ink-muted">
                    <Sparkles className="size-8 text-accent mb-2" />
                    <p className="font-display font-semibold text-sm text-ink">Illustrated Edition</p>
                    <p className="text-[11px] text-ink-muted mt-1 max-w-xs">
                      {project.coverPrompt || 'Cover illustration generated with Gemini image model'}
                    </p>
                  </div>
                )}
              </div>

              {/* Cover Footer / Author */}
              <div className="relative z-10 w-full pb-1 border-t border-line/60 pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-ink">
                  By {project.author || 'Author'}
                </p>
                <p className="text-[10px] text-ink-muted mt-0.5">Publisher Toolkit Books</p>
              </div>
            </div>
          ) : (
            /* ========================================== */
            /* REALISTIC INTERIOR SPREAD PRESENTATION */
            /* ========================================== */
            <div className="w-full max-w-4xl">
              {content?.type === 'children' && content.pages[activeInteriorIdx] && (
                (() => {
                  const page = content.pages[activeInteriorIdx]
                  return (
                    <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-2xl">
                      {/* Left Page: Narrative text */}
                      <div className="flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-line/60 pb-6 sm:pb-0 sm:pr-8">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                            Page {page.pageNumber}
                          </span>
                          {page.spreadHeading && (
                            <h3 className="mt-2 font-display text-xl font-bold text-ink">
                              {page.spreadHeading}
                            </h3>
                          )}
                          <div className="mt-4 font-serif text-base sm:text-lg leading-relaxed text-ink/90">
                            <p className="whitespace-pre-wrap">{page.storyText}</p>
                          </div>
                        </div>

                        <div className="mt-6 text-center font-mono text-xs text-ink-muted">
                          {page.pageNumber}
                        </div>
                      </div>

                      {/* Right Page: Full illustration */}
                      <div className="flex flex-col justify-between sm:pl-4">
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-line bg-surface-2 flex items-center justify-center">
                          {page.generatedImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={page.generatedImageUrl}
                              alt={`Page ${page.pageNumber}`}
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-4 text-ink-muted">
                              <Sparkles className="size-6 text-accent mx-auto mb-1" />
                              <p className="text-xs font-semibold text-ink">Illustration Pending</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-6 text-center font-mono text-xs text-ink-muted">
                          Spread Layout
                        </div>
                      </div>
                    </div>
                  )
                })()
              )}

              {content?.type === 'coloring' && content.pages[activeInteriorIdx] && (
                (() => {
                  const page = content.pages[activeInteriorIdx]
                  return (
                    <div className="mx-auto flex flex-col items-center justify-between aspect-[3/4] w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl text-center">
                      <div className="w-full text-left">
                        <span className="text-[10px] font-bold text-ink-muted uppercase">
                          Page {page.pageNumber}
                        </span>
                        <h3 className="font-bold text-base text-ink">{page.title}</h3>
                      </div>

                      <div className="my-4 flex-1 w-full overflow-hidden rounded-xl border border-line bg-white p-2 flex items-center justify-center">
                        {page.generatedImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={page.generatedImageUrl}
                            alt={page.title}
                            className="size-full object-contain"
                          />
                        ) : (
                          <div className="text-center p-4 text-ink-muted">
                            <Palette className="size-6 text-accent mx-auto mb-1" />
                            <p className="text-xs font-semibold text-ink">Line Art Pending</p>
                          </div>
                        )}
                      </div>

                      <div className="w-full text-center font-mono text-xs text-ink-muted">
                        Page {page.pageNumber}
                      </div>
                    </div>
                  )
                })()
              )}

              {content?.type === 'word_game' && content.wordSearches[activeInteriorIdx] && (
                (() => {
                  const ws = content.wordSearches[activeInteriorIdx]
                  return (
                    <div className="grid gap-6 sm:grid-cols-2 rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-2xl">
                      {/* Left: Artwork and Word Bank */}
                      <div className="flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-line/60 pb-6 sm:pb-0 sm:pr-6">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                            Word Search #{ws.puzzleNumber}
                          </span>
                          <h3 className="mt-1 font-bold text-lg text-ink">{ws.title}</h3>
                          <p className="text-xs text-ink-muted">Theme: {ws.theme}</p>

                          {ws.illustrationUrl && (
                            <div className="mt-3 overflow-hidden rounded-xl border border-line">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ws.illustrationUrl} alt="" className="h-32 w-full object-cover" />
                            </div>
                          )}

                          <div className="mt-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-ink mb-2">Word Bank</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ws.wordList.map((w) => (
                                <span key={w} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-mono font-medium text-ink">
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {ws.hiddenFact && (
                          <p className="mt-4 text-[11px] text-ink-muted italic border-t border-line/60 pt-2">
                            ✦ {ws.hiddenFact}
                          </p>
                        )}
                      </div>

                      {/* Right: The Grid */}
                      <div className="flex flex-col items-center justify-center">
                        <div
                          className="inline-grid gap-1 rounded-xl border border-line bg-surface-2 p-2.5 shadow-inner"
                          style={{ gridTemplateColumns: `repeat(${ws.gridSize}, minmax(0, 1fr))` }}
                        >
                          {ws.grid.map((row, rIdx) =>
                            row.map((char, cIdx) => (
                              <span
                                key={`${rIdx}-${cIdx}`}
                                className="grid size-6 sm:size-7 place-items-center rounded bg-surface font-mono text-[11px] font-bold text-ink"
                              >
                                {char}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()
              )}

              {content?.type === 'short_story' && (
                <div className="grid gap-6 sm:grid-cols-2 rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-2xl">
                  {/* Left: Text */}
                  <div className="font-serif text-sm sm:text-base leading-relaxed text-ink/90 space-y-3">
                    <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-accent">
                      Story Book
                    </span>
                    <h3 className="font-display text-xl font-bold text-ink">{content.story.title}</h3>
                    <p className="whitespace-pre-wrap">{content.story.storyText}</p>
                  </div>

                  {/* Right: Scene Artwork */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-line bg-surface-2 flex items-center justify-center">
                      {content.story.illustrationUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={content.story.illustrationUrl}
                          alt={content.story.title}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-4 text-ink-muted">
                          <Feather className="size-6 text-accent mx-auto mb-1" />
                          <p className="text-xs font-semibold text-ink">Scene Artwork Pending</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Controls */}
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-3 sm:px-5 sm:py-3.5 bg-surface-2/60">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>

          {/* Quick Page Jump Selector */}
          <div className="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto px-1 py-0.5 sm:justify-center">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPageIndex(idx)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                  pageIndex === idx
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'bg-surface text-ink-muted hover:text-ink border border-line/60'
                )}
              >
                {idx === 0 ? 'Cover' : `P.${idx}`}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={pageIndex === totalSteps - 1}
            onClick={() => setPageIndex((p) => Math.min(totalSteps - 1, p + 1))}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
