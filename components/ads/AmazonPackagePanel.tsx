'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Film,
  Layers,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { AdCopy } from '@prisma/client'

export function AmazonPackagePanel({
  projectId,
  title,
  copy,
  hasVideo,
  imageCount,
}: {
  projectId: string
  title: string
  copy?: AdCopy | null
  hasVideo?: boolean
  imageCount: number
}) {
  const [copied, setCopied] = useState(false)

  const handleCopyText = async () => {
    if (!copy) return
    const textToCopy = [
      `Amazon Ad & A+ Content Copy: ${title}`,
      '='.repeat(40),
      `Headline: ${copy.headline}`,
      `Primary Text: ${copy.primaryText}`,
      `Description: ${copy.description}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      toast.success('Amazon ad copy copied to clipboard')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-4 text-accent" />
            <h2 className="font-display text-lg font-semibold">Amazon Launch Hub</h2>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Your campaign package is formatted and verified for Amazon KDP & Advertising.
          </p>
        </div>
      </div>

      {/* Primary Download Button */}
      <a
        href={`/api/ads/projects/${projectId}/download`}
        className={buttonClasses({
          variant: 'primary',
          size: 'lg',
          className: 'w-full justify-center shadow-lift',
        })}
      >
        <Download className="size-4" /> Download Complete Kit (.zip)
      </a>

      {/* Package Contents Checklist */}
      <div className="rounded-2xl bg-surface-2 p-4 shadow-inset">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Package Contents
        </span>
        <ul className="mt-3 space-y-2 text-xs">
          <li className="flex items-center gap-2 text-ink">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <span>
              <strong>Amazon KDP A+ Content</strong> (970×600, 970×300, 300×300)
            </span>
          </li>
          <li className="flex items-center gap-2 text-ink">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <span>
              <strong>Amazon Sponsored Ads</strong> (300×250, 1200×628)
            </span>
          </li>
          {hasVideo && (
            <li className="flex items-center gap-2 text-ink">
              <CheckCircle2 className="size-4 shrink-0 text-success" />
              <span>
                <strong>Sponsored Brands Video</strong> (1080p MP4 trailer)
              </span>
            </li>
          )}
          <li className="flex items-center gap-2 text-ink">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <span>
              <strong>Verified Amazon Copy & Hooks</strong> (copy.txt)
            </span>
          </li>
        </ul>
      </div>

      {/* 1-Click Copy Ad Copy */}
      {copy && (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyText}
            className="w-full justify-center"
          >
            <Copy className="size-3.5" />
            {copied ? 'Copied to Clipboard!' : 'Copy Amazon Ad Copy'}
          </Button>
        </div>
      )}

      {/* Quick Launch Direct Links */}
      <div className="flex flex-col gap-2 border-t border-line/60 pt-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Quick Launch Consoles
        </span>
        <div className="flex flex-col gap-2">
          <a
            href="https://kdp.amazon.com/marketing/aplus-content"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-surface p-3 text-xs font-medium text-ink transition-colors hover:bg-surface-2 border border-line/50"
          >
            <span className="flex items-center gap-2">
              <Layers className="size-4 text-accent" />
              <span>KDP A+ Content Manager</span>
            </span>
            <ExternalLink className="size-3.5 text-ink-muted" />
          </a>
          <a
            href="https://advertising.amazon.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-surface p-3 text-xs font-medium text-ink transition-colors hover:bg-surface-2 border border-line/50"
          >
            <span className="flex items-center gap-2">
              <Film className="size-4 text-accent" />
              <span>Amazon Ads Console</span>
            </span>
            <ExternalLink className="size-3.5 text-ink-muted" />
          </a>
        </div>
      </div>

      {/* Deployment Quick Guide */}
      <div className="rounded-xl border border-line/60 bg-surface/50 p-3.5 text-xs text-ink-muted">
        <span className="font-semibold text-ink block mb-1">How to deploy on Amazon:</span>
        <ol className="list-decimal list-inside space-y-1">
          <li>Extract downloaded zip package to your computer.</li>
          <li>In KDP A+ Content Manager, create a project and upload the 970×600 and 970×300 banners.</li>
          <li>In Amazon Ads, launch a Sponsored Brands campaign with the 16:9 video trailer.</li>
        </ol>
      </div>
    </Card>
  )
}
