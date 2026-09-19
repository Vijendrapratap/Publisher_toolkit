'use client'

import { useState } from 'react'
import { Check, Copy, Download, Palette, Sparkles, Printer } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import type { ColoringPage } from '@/lib/services/creator/types'

export function ColoringBookViewer({ pages }: { pages: ColoringPage[] }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  if (!pages || pages.length === 0) {
    return (
      <Card className="p-8 text-center text-ink-muted">
        No coloring pages generated yet.
      </Card>
    )
  }

  function handleCopy(prompt: string, idx: number) {
    navigator.clipboard.writeText(prompt)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 rounded-2xl border border-line/70 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Palette className="size-4 text-accent" />
            {pages.length} Themed Coloring Page Spreads
          </h3>
          <p className="text-xs text-ink-muted">
            Clean vector line art prompts engineered for Amazon KDP 8.5×11" paperback format.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-muted">
            High Contrast • Zero Grayscale
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p, idx) => (
          <Card key={p.pageNumber} className="flex flex-col justify-between p-5 transition hover:border-accent/40">
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

              <h4 className="mt-3 text-base font-bold text-ink">{p.title}</h4>
              <p className="mt-1 text-xs text-ink-muted leading-relaxed">{p.sceneDescription}</p>

              {/* Line Art Prompt Box */}
              <div className="mt-4 rounded-xl border border-line bg-surface-2/70 p-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-accent">
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-3" /> Midjourney / Flux Prompt
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(p.lineArtPrompt, idx)}
                    className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
                  >
                    {copiedIdx === idx ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    {copiedIdx === idx ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-ink-muted leading-relaxed line-clamp-4">
                  {p.lineArtPrompt}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
              <span className="text-[10px] text-ink-muted">Ready for vector trace</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(p.lineArtPrompt, idx)}
              >
                <Copy className="size-3" /> Copy Prompt
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
