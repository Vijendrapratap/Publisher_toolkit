'use client'

import { useState } from 'react'
import {
  BookOpen,
  Sparkles,
  Clock,
  FileText,
  Image as ImageIcon,
  Copy,
  Check,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ShortStoryContent } from '@/lib/services/creator/types'

export function StoryBookViewer({
  story,
}: {
  story: ShortStoryContent
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(story.storyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const paragraphs = story.storyText.split('\n\n').filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Card */}
      <Card className="p-6 bg-surface-2/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
                Story Book
              </span>
              <span className="text-xs text-ink-muted">Theme: <strong className="text-ink">{story.theme}</strong></span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {story.title}
            </h2>
            {story.synopsis && (
              <p className="mt-1 text-sm text-ink-muted max-w-2xl leading-relaxed">
                {story.synopsis}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-ink-muted flex items-center justify-end gap-1">
                <Clock className="size-3" /> Reading Time
              </span>
              <p className="font-mono text-sm font-bold text-ink">
                {story.readingTimeMinutes || Math.max(1, Math.round(story.wordCount / 200))} min
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-ink-muted flex items-center justify-end gap-1">
                <FileText className="size-3" /> Length
              </span>
              <p className="font-mono text-sm font-bold text-accent">
                {story.wordCount.toLocaleString()} words
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Story Prose (7 cols) */}
        <Card className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7">
          <div className="space-y-4 font-serif text-lg leading-relaxed text-ink/90 sm:text-xl">
            {paragraphs.map((p, idx) => (
              <p key={idx} className={idx === 0 ? 'first-letter:float-left first-letter:text-5xl first-letter:pr-3 first-letter:font-bold first-letter:font-display first-letter:text-accent' : ''}>
                {p}
              </p>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-line/60 pt-4 text-xs text-ink-muted">
            <span>Standard storybook typography</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              {copied ? 'Story Copied' : 'Copy Story'}
            </Button>
          </div>
        </Card>

        {/* Right Column: Scene Illustration Artwork (5 cols) */}
        <Card className="flex flex-col justify-between p-6 bg-surface-2/40 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                <Sparkles className="size-3.5" /> Scene Artwork
              </span>
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted border border-line">
                AI Image Model
              </span>
            </div>

            {story.illustrationUrl ? (
              <div className="group relative mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={story.illustrationUrl}
                  alt={story.title}
                  className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              </div>
            ) : (
              <div className="mt-4 flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center">
                <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <ImageIcon className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">Scene Artwork Pending</p>
                  <p className="mt-1 text-xs text-ink-muted max-w-xs">
                    Use the "Illustrate Book" button in the header to generate scene artwork with the image model.
                  </p>
                </div>
              </div>
            )}

          </div>

          <div className="mt-6 border-t border-line/60 pt-4 text-xs text-ink-muted">
            Included in PDF export and book preview.
          </div>
        </Card>
      </div>
    </div>
  )
}
