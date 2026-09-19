'use client'

import { useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Copy, Check, Sparkles, Image as ImageIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import type { StoryPage } from '@/lib/services/creator/types'

export function ChildrenBookViewer({ pages }: { pages: StoryPage[] }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  if (!pages || pages.length === 0) {
    return (
      <Card className="p-8 text-center text-ink-muted">
        No story pages generated yet.
      </Card>
    )
  }

  const page = pages[currentPage]

  function handleCopyPrompt() {
    if (!page) return
    navigator.clipboard.writeText(page.illustrationPrompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

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
        {/* Left Column: Story Prose (7 cols) */}
        <Card className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7">
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
            Tip: Use this narrative directly for Kindle Kids KDP text frames or audio narration.
          </div>
        </Card>

        {/* Right Column: Illustration Prompt & Art Concept (5 cols) */}
        <Card className="flex flex-col justify-between p-6 bg-surface-2/40 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                <Sparkles className="size-3.5" /> AI Illustration Prompt
              </span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-muted hover:border-accent hover:text-ink"
              >
                {copiedPrompt ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                {copiedPrompt ? 'Copied' : 'Copy'}
              </button>
            </div>

            {page.generatedImageUrl ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.generatedImageUrl} alt="" className="size-full object-cover" />
              </div>
            ) : (
              <div className="mt-4 flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface p-4 text-center">
                <ImageIcon className="size-8 text-ink-muted/60" />
                <p className="text-xs font-semibold text-ink">Ready for Illustration</p>
                <p className="text-[11px] text-ink-muted">Use Midjourney, DALL-E 3, or Nano-Banana with prompt below</p>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-line/70 bg-surface p-3.5 text-xs font-mono leading-relaxed text-ink-muted">
              {page.illustrationPrompt}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-4">
            <span className="text-[11px] text-ink-muted">Compatible with Midjourney & Ideogram</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyPrompt}
            >
              <Copy className="size-3.5" /> Copy Prompt
            </Button>
          </div>
        </Card>
      </div>

      {/* Thumbnail Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {pages.map((p, idx) => (
          <button
            key={p.pageNumber}
            type="button"
            onClick={() => setCurrentPage(idx)}
            className={cn(
              'flex shrink-0 flex-col items-start rounded-xl border p-2.5 text-left transition-all w-32',
              currentPage === idx
                ? 'border-accent bg-accent-soft/80 shadow-inset ring-2 ring-accent/30'
                : 'border-line bg-surface hover:border-accent/40'
            )}
          >
            <span className="text-[10px] font-bold uppercase text-accent">Page {p.pageNumber}</span>
            <span className="mt-1 truncate text-xs font-semibold text-ink">
              {p.spreadHeading || `Spread ${p.pageNumber}`}
            </span>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-ink-muted">{p.storyText}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
