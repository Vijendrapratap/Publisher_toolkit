'use client'

import { useState } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import type { StoryPage } from '@/lib/services/creator/types'

export function ChildrenBookViewer({
  pages,
}: {
  pages: StoryPage[]
}) {
  const [currentPage, setCurrentPage] = useState(0)

  if (!pages || pages.length === 0) {
    return (
      <Card className="p-8 text-center text-ink-muted">
        No story pages generated yet.
      </Card>
    )
  }

  const page = pages[currentPage]

  return (
    <div className="flex flex-col gap-6">
      {/* Page Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-surface p-4 shadow-subtle">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-accent" aria-hidden />
          <span className="text-sm font-semibold text-ink">
            Page Spread {currentPage + 1} of {pages.length}
          </span>
          {page.spreadHeading && (
            <span className="hidden text-xs text-ink-muted sm:inline">• {page.spreadHeading}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <span className="font-mono text-xs text-ink-muted">
            {currentPage + 1} / {pages.length}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={currentPage === pages.length - 1}
            onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Two-Column Story Spread */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Story Prose (6 cols) */}
        <Card className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
                Page {page.pageNumber}
              </span>
              {page.characterFocus && (
                <span className="text-xs text-ink-muted">
                  Focus: <strong className="text-ink">{page.characterFocus}</strong>
                </span>
              )}
            </div>

            {page.spreadHeading && (
              <h3 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl">
                {page.spreadHeading}
              </h3>
            )}

            <div className="mt-6 font-serif text-lg leading-relaxed text-ink/90 sm:text-xl">
              <p className="whitespace-pre-wrap">{page.storyText}</p>
            </div>
          </div>

          <div className="mt-8 border-t border-line/60 pt-4 text-xs text-ink-muted">
            Ready for print layout & Kindle Kids picture book format.
          </div>
        </Card>

        {/* Right Column: Generated Illustration Artwork (6 cols) */}
        <Card className="flex flex-col justify-between p-6 bg-surface-2/40 lg:col-span-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                <Sparkles className="size-3.5" /> Page {page.pageNumber} Artwork
              </span>
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted border border-line">
                AI Image Model
              </span>
            </div>

            {page.generatedImageUrl ? (
              <div className="group relative mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.generatedImageUrl}
                  alt={`Illustration for Page ${page.pageNumber}`}
                  className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              </div>
            ) : (
              <div className="mt-4 flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center">
                <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <ImageIcon className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">Image Pending</p>
                  <p className="mt-1 text-xs text-ink-muted max-w-xs">
                    Use the "Illustrate Book" button in the header to generate illustrations for all pages with the image model.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line/60 pt-4 text-xs text-ink-muted">
            <span>High-resolution 4:3 picture book spread</span>
            <span>KDP Print Ready</span>
          </div>
        </Card>
      </div>

      {/* Bottom Thumbnail Strip - FIXED: text never lurks out of box */}
      <div className="rounded-2xl border border-line/70 bg-surface-2/40 p-3 shadow-subtle">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Page Spreads ({pages.length})
          </span>
          <span className="text-[11px] text-ink-muted">
            Click to view spread
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
          {pages.map((p, idx) => {
            const isSelected = currentPage === idx
            return (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => setCurrentPage(idx)}
                className={cn(
                  'group flex w-36 sm:w-40 shrink-0 min-w-0 flex-col items-start rounded-xl border p-2 text-left transition-all overflow-hidden',
                  isSelected
                    ? 'border-accent bg-accent-soft/80 shadow-sm ring-2 ring-accent/30'
                    : 'border-line bg-surface hover:border-accent/40 hover:bg-surface-2'
                )}
              >
                {/* Mini Image Preview */}
                <div className="relative mb-2 h-14 w-full overflow-hidden rounded-lg border border-line/60 bg-surface-2">
                  {p.generatedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.generatedImageUrl}
                      alt=""
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-ink-muted/40">
                      <ImageIcon className="size-4" />
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    P. {p.pageNumber}
                  </span>
                </div>

                <div className="w-full min-w-0">
                  <span className="block w-full min-w-0 truncate text-xs font-semibold text-ink">
                    {p.spreadHeading || `Spread ${p.pageNumber}`}
                  </span>
                  <p className="mt-0.5 block w-full min-w-0 truncate text-[10px] text-ink-muted">
                    {p.storyText}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
