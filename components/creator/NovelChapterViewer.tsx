'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Feather,
  FileText,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import type { NovelContent, ChapterItem } from '@/lib/services/creator/types'

export function NovelChapterViewer({
  projectId,
  novel,
  onChapterUpdated,
}: {
  projectId: string
  novel: NovelContent
  onChapterUpdated?: (chapter: ChapterItem) => void
}) {
  const [activeChapterNum, setActiveChapterNum] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [chapters, setChapters] = useState<ChapterItem[]>(novel.chapters || [])

  const activeChapter = chapters.find((c) => c.chapterNumber === activeChapterNum) || chapters[0]

  async function handleGenerateChapter() {
    if (!activeChapter) return
    setGenerating(true)

    try {
      const res = await fetch(`/api/creator/projects/${projectId}/chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterNumber: activeChapter.chapterNumber }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate chapter')
      }

      const updatedChapters = chapters.map((c) =>
        c.chapterNumber === activeChapter.chapterNumber ? data.chapter : c
      )
      setChapters(updatedChapters)
      onChapterUpdated?.(data.chapter)
      toast.success(`Chapter ${activeChapter.chapterNumber} written!`, {
        description: `Generated ${data.chapter.wordCount} words.`,
      })
    } catch (err: any) {
      toast.error('Chapter generation failed', { description: err.message })
    } finally {
      setGenerating(false)
    }
  }

  const completedChaptersCount = chapters.filter((c) => c.status === 'completed' && c.content).length
  const totalWordCount = chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Novel Premise Hero Card */}
      <Card className="p-6 bg-surface-2/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
              Novel Architecture & Continuity Outline
            </span>
            <p className="mt-2 text-sm font-semibold text-ink sm:text-base">
              {novel.logline || novel.premise}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-ink-muted">Progress</span>
              <p className="font-mono text-sm font-bold text-ink">
                {completedChaptersCount} / {chapters.length} chapters
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-ink-muted">Total Words</span>
              <p className="font-mono text-sm font-bold text-accent">
                {totalWordCount.toLocaleString()} words
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${(completedChaptersCount / Math.max(1, chapters.length)) * 100}%` }}
          />
        </div>
      </Card>

      {/* Two Column Chapter Studio */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Outline & Chapters List (4 cols) */}
        <Card className="p-4 lg:col-span-4">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
            <FileText className="size-4 text-accent" /> Chapters Outline
          </h4>

          <div className="mt-3 flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
            {chapters.map((c) => {
              const isSelected = activeChapter.chapterNumber === c.chapterNumber
              const isCompleted = c.status === 'completed' && Boolean(c.content)
              return (
                <button
                  key={c.chapterNumber}
                  type="button"
                  onClick={() => setActiveChapterNum(c.chapterNumber)}
                  className={cn(
                    'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                    isSelected
                      ? 'border-accent bg-accent-soft/80 shadow-inset ring-2 ring-accent/30'
                      : 'border-line/70 bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                      Chapter {c.chapterNumber}
                    </span>
                    {isCompleted ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
                        <CheckCircle2 className="size-3" /> {c.wordCount} words
                      </span>
                    ) : (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold text-xs text-ink line-clamp-1">{c.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-ink-muted leading-relaxed">{c.summary}</p>
                </button>
              )
            })}
          </div>
        </Card>

        {/* Right: Chapter Reader & AI Writer (8 cols) */}
        <Card className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  Chapter {activeChapter.chapterNumber}
                </span>
                <h3 className="font-display text-2xl font-bold text-ink">{activeChapter.title}</h3>
                {activeChapter.setting && (
                  <p className="text-xs text-ink-muted mt-0.5">Setting: {activeChapter.setting}</p>
                )}
              </div>

              {activeChapter.content ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ink-muted">
                    {activeChapter.wordCount} words
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={generating}
                    onClick={handleGenerateChapter}
                  >
                    <Wand2 className="size-3.5" /> Rewrite
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Chapter Summary / Scene Goal */}
            <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3.5 text-xs text-ink-muted">
              <strong className="text-ink">Scene Goal: </strong>
              {activeChapter.summary}
            </div>

            {/* Content Area */}
            {activeChapter.content ? (
              <div className="mt-6 font-serif text-base sm:text-lg leading-relaxed text-ink/90 whitespace-pre-wrap">
                {activeChapter.content}
              </div>
            ) : (
              <div className="mt-12 flex flex-col items-center justify-center gap-4 py-8 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent shadow-subtle">
                  <Feather className="size-7" />
                </div>
                <div className="max-w-md">
                  <h4 className="font-display text-lg font-bold text-ink">Chapter Not Yet Written</h4>
                  <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                    Click below to generate Chapter {activeChapter.chapterNumber} based on the outline, previous chapter continuity, and sensory scene beats.
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  loading={generating}
                  onClick={handleGenerateChapter}
                >
                  {generating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Writing Chapter {activeChapter.chapterNumber}…
                    </>
                  ) : (
                    <>
                      <Wand2 className="size-4" /> Write Chapter {activeChapter.chapterNumber}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {activeChapter.content && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
              <span className="text-xs text-ink-muted">
                Tip: Sequential generation maintains character and plot continuity.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={activeChapter.chapterNumber <= 1}
                  onClick={() => setActiveChapterNum((n) => Math.max(1, n - 1))}
                >
                  Previous Chapter
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={activeChapter.chapterNumber >= chapters.length}
                  onClick={() => setActiveChapterNum((n) => Math.min(chapters.length, n + 1))}
                >
                  Next Chapter <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
