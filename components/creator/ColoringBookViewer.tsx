'use client'

import { useState } from 'react'
import {
  Palette,
  Sparkles,
  Printer,
  Download,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  BookOpen,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import type { ColoringPage } from '@/lib/services/creator/types'

export function ColoringBookViewer({ pages }: { pages: ColoringPage[] }) {
  const [viewMode, setViewMode] = useState<'spread' | 'grid'>('spread')
  const [currentPage, setCurrentPage] = useState(0)

  if (!pages || pages.length === 0) {
    return (
      <Card className="p-8 text-center text-ink-muted">
        No coloring pages generated yet.
      </Card>
    )
  }

  const activePage = pages[currentPage] || pages[0]

  function handlePrintPage(imageUrl?: string) {
    if (!imageUrl) return
    const win = window.open('')
    if (win) {
      win.document.write(`
        <html>
          <head><title>Print Coloring Page</title></head>
          <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;">
            <img src="${imageUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" onload="window.print();window.close();" />
          </body>
        </html>
      `)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between shadow-subtle">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Palette className="size-4 text-accent" />
            {pages.length} Themed Coloring Page Spreads
          </h3>
          <p className="text-xs text-ink-muted">
            High-contrast vector line art generated for Amazon KDP 8.5x11" printable coloring books.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-xl border border-line bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('spread')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                viewMode === 'spread'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <BookOpen className="size-3.5" /> Spread View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                viewMode === 'grid'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <LayoutGrid className="size-3.5" /> All Pages
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'spread' ? (
        /* SPREAD VIEW */
        <div className="flex flex-col gap-6">
          {/* Navigation Bar */}
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 shadow-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" /> Previous Page
            </Button>

            <span className="font-mono text-xs font-semibold text-ink">
              Page {currentPage + 1} of {pages.length} • {activePage.title}
            </span>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={currentPage === pages.length - 1}
              onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
            >
              Next Page <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Main Coloring Spread Card */}
          <Card className="grid gap-6 p-6 lg:grid-cols-12">
            {/* Left: Line Art Image Preview (7 cols) */}
            <div className="flex flex-col items-center justify-center lg:col-span-7">
              <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border-2 border-line bg-white p-3 shadow-card flex items-center justify-center">
                {activePage.generatedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activePage.generatedImageUrl}
                    alt={activePage.title}
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-ink-muted">
                    <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-muted">
                      <ImageIcon className="size-6" />
                    </div>
                    <p className="text-sm font-semibold text-ink">Line Art Pending</p>
                    <p className="text-xs text-ink-muted max-w-xs">
                      Use the "Illustrate Book" button in the header to generate line art images with the image model.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Details & Print Controls (5 cols) */}
            <div className="flex flex-col justify-between lg:col-span-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
                    Page {activePage.pageNumber}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      activePage.detailLevel === 'simple'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : activePage.detailLevel === 'moderate'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    )}
                  >
                    {activePage.detailLevel} complexity
                  </span>
                </div>

                <h3 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl">
                  {activePage.title}
                </h3>
                <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                  {activePage.sceneDescription}
                </p>

                {/* Print & Download Actions */}
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {activePage.generatedImageUrl && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePrintPage(activePage.generatedImageUrl)}
                      >
                        <Printer className="size-3.5" /> Print Sheet
                      </Button>
                      <a
                        href={activePage.generatedImageUrl}
                        download={`coloring-page-${activePage.pageNumber}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-subtle hover:border-accent"
                      >
                        <Download className="size-3.5" /> Download Image
                      </a>
                    </>
                  )}
                </div>

              </div>

              <div className="mt-6 border-t border-line/60 pt-4 text-xs text-ink-muted">
                Clean black vector outlines • 8.5×11" KDP printable sheet
              </div>
            </div>
          </Card>

          {/* Bottom Thumbnail Strip - FIXED: text never lurks out of box */}
          <div className="rounded-2xl border border-line/70 bg-surface-2/40 p-3 shadow-subtle">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Coloring Sheets ({pages.length})
              </span>
              <span className="text-[11px] text-ink-muted">Click to view sheet</span>
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
                    {/* Mini Line Art Preview */}
                    <div className="relative mb-2 h-16 w-full overflow-hidden rounded-lg border border-line/60 bg-white flex items-center justify-center">
                      {p.generatedImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.generatedImageUrl}
                          alt=""
                          className="size-full object-contain p-1 transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-ink-muted/40">
                          <Palette className="size-4" />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        P. {p.pageNumber}
                      </span>
                    </div>

                    <div className="w-full min-w-0">
                      <span className="block w-full min-w-0 truncate text-xs font-semibold text-ink">
                        {p.title}
                      </span>
                      <p className="mt-0.5 block w-full min-w-0 truncate text-[10px] text-ink-muted">
                        {p.sceneDescription}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p, idx) => (
            <Card
              key={p.pageNumber}
              className="flex flex-col justify-between overflow-hidden p-5 transition hover:border-accent/50 hover:shadow-card"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                    Page {p.pageNumber}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      p.detailLevel === 'simple'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : p.detailLevel === 'moderate'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    )}
                  >
                    {p.detailLevel}
                  </span>
                </div>

                {/* Line Art Image Box */}
                <div className="relative mt-3 aspect-[3/4] w-full overflow-hidden rounded-xl border border-line bg-white p-2 flex items-center justify-center">
                  {p.generatedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.generatedImageUrl}
                      alt={p.title}
                      className="size-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-ink-muted">
                      <ImageIcon className="size-6 text-ink-muted/50" />
                      <span className="text-xs font-medium">Ready for artwork</span>
                    </div>
                  )}
                </div>

                <h4 className="mt-3 block w-full min-w-0 truncate text-sm font-bold text-ink">
                  {p.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-ink-muted leading-relaxed">
                  {p.sceneDescription}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(idx)
                    setViewMode('spread')
                  }}
                  className="font-semibold text-accent hover:underline"
                >
                  View Spread →
                </button>
                {p.generatedImageUrl && (
                  <button
                    type="button"
                    onClick={() => handlePrintPage(p.generatedImageUrl)}
                    className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                  >
                    <Printer className="size-3.5" /> Print
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
