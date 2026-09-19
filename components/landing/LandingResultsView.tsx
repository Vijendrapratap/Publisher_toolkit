'use client'

import { useState } from 'react'
import Link from 'next/navigation'
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Download,
  FileArchive,
  Smartphone,
  Monitor,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { toast } from 'sonner'

export function LandingResultsView({
  projectId,
  title,
  publishedSlug,
  template,
}: {
  projectId: string
  title: string
  publishedSlug: string
  template: string
}) {
  const [copied, setCopied] = useState(false)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${publishedSlug}` : `/p/${publishedSlug}`

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success('Public landing page URL copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Live Publishing Banner */}
      <Card className="p-6 bg-gradient-to-r from-accent/15 via-surface to-surface border-accent/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-on-accent shadow-card shrink-0">
              <Globe className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold">Your Book Website is Live!</h2>
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent uppercase">
                  Published
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">
                Your high-converting book landing page is accessible worldwide with zero setup.
              </p>

              {/* Public URL Box */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs text-ink">
                  <span className="truncate max-w-xs sm:max-w-md">{publicUrl}</span>
                </div>

                <Button variant="ghost" size="sm" onClick={copyUrl}>
                  {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </Button>

                <a href={`/p/${publishedSlug}`} target="_blank" rel="noopener noreferrer" className="inline-flex">
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="size-3.5" /> Visit Live Site
                  </Button>
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
            <a href={`/api/landing/projects/${projectId}/html`} download className="inline-flex">
              <Button variant="secondary" size="md">
                <Download className="size-4" /> Download index.html
              </Button>
            </a>
            <a href={`/api/landing/projects/${projectId}/download`} download className="inline-flex">
              <Button variant="primary" size="md" className="shadow-card">
                <FileArchive className="size-4" /> Download Website ZIP
              </Button>
            </a>
            <a href={`/landing/${projectId}/configure`}>
              <Button variant="ghost" size="md">
                <SlidersHorizontal className="size-4" /> Edit Design
              </Button>
            </a>
          </div>
        </div>
      </Card>

      {/* Live Interactive Preview Stage */}
      <Card className="overflow-hidden p-0 border border-line/70">
        <div className="flex items-center justify-between border-b border-line/60 bg-surface-2/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Interactive Sandbox Preview</span>
            <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-mono text-ink-muted capitalize">
              Template: {template}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-surface-3 p-1">
            <button
              type="button"
              onClick={() => setPreviewMode('desktop')}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-all',
                previewMode === 'desktop' ? 'bg-surface text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
              )}
            >
              <Monitor className="size-3.5" /> Desktop (1200px)
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('mobile')}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-all',
                previewMode === 'mobile' ? 'bg-surface text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
              )}
            >
              <Smartphone className="size-3.5" /> Mobile (375px)
            </button>
          </div>
        </div>

        <div className="flex justify-center bg-black/95 p-4 sm:p-8 overflow-hidden min-h-[580px]">
          <div
            className={cn(
              'h-[560px] overflow-hidden rounded-2xl border border-white/10 bg-surface transition-all duration-300 shadow-2xl',
              previewMode === 'desktop' ? 'w-full max-w-5xl' : 'w-[375px] ring-4 ring-white/10'
            )}
          >
            <iframe
              src={`/p/${publishedSlug}`}
              className="h-full w-full border-0 bg-background"
              title="Live Book Landing Page"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
