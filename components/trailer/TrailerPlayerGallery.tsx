'use client'
import { useState } from 'react'
import { Download, Film, Image as ImageIcon, Smartphone, Square, Tv } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { buttonClasses } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/components/ui/cn'

export interface TrailerItem {
  id: string
  aspectRatio: string
  videoUrl: string
  posterUrl: string
  duration: number
  width: number
  height: number
}

const ASPECT_DETAILS: Record<
  string,
  { label: string; icon: React.ElementType; bestFor: string[]; containerClass: string }
> = {
  '9:16': {
    label: 'Vertical (9:16)',
    icon: Smartphone,
    bestFor: ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Stories'],
    containerClass: 'max-w-[320px] aspect-[9/16]',
  },
  '1:1': {
    label: 'Square (1:1)',
    icon: Square,
    bestFor: ['Instagram Feed', 'Facebook Feed', 'LinkedIn', 'Twitter/X'],
    containerClass: 'max-w-[460px] aspect-square',
  },
  '16:9': {
    label: 'Widescreen (16:9)',
    icon: Tv,
    bestFor: ['YouTube', 'Author Website', 'Amazon Central', 'Landscape Ads'],
    containerClass: 'max-w-2xl aspect-video',
  },
}

export function TrailerPlayerGallery({
  trailers,
  metadata,
}: {
  trailers: TrailerItem[]
  metadata: {
    title: string
    author: string
    style: string
    musicMood: string
    length: string
  }
}) {
  const [selectedAspect, setSelectedAspect] = useState<string>(trailers[0]?.aspectRatio ?? '9:16')
  const active = trailers.find((t) => t.aspectRatio === selectedAspect) ?? trailers[0]
  const details = ASPECT_DETAILS[active?.aspectRatio ?? '9:16'] ?? ASPECT_DETAILS['9:16']

  if (!active) {
    return (
      <Card className="p-8 text-center text-ink-muted">
        No video trailers generated yet.
      </Card>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        {/* Aspect ratio switcher tabs */}
        <div className="flex flex-wrap gap-2 rounded-2xl bg-surface-2 p-1.5 shadow-inset" role="tablist">
          {trailers.map((t) => {
            const isSelected = t.aspectRatio === selectedAspect
            const conf = ASPECT_DETAILS[t.aspectRatio] ?? { label: t.aspectRatio, icon: Film }
            const Icon = conf.icon
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedAspect(t.aspectRatio)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all',
                  isSelected
                    ? 'bg-surface text-ink shadow-card'
                    : 'text-ink-muted hover:text-ink hover:bg-surface/50'
                )}
              >
                <Icon className="size-4" aria-hidden />
                {conf.label}
              </button>
            )
          })}
        </div>

        {/* Video Player Card */}
        <Card className="flex flex-col items-center justify-center overflow-hidden bg-black p-4 sm:p-8">
          <div className={cn('relative w-full overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10', details.containerClass)}>
            <video
              key={active.videoUrl}
              controls
              playsInline
              preload="metadata"
              poster={active.posterUrl}
              src={active.videoUrl}
              className="size-full bg-black object-contain"
            />
          </div>
        </Card>

        {/* Action buttons & Details row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{active.width}×{active.height}</Badge>
            <Badge tone="neutral">{active.duration}s runtime</Badge>
            <Badge tone="accent">H.264 / AAC</Badge>
            <Badge tone="accent" className="capitalize">{metadata.style} style</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={active.posterUrl}
              download={`${metadata.title || 'book'}-poster-${active.aspectRatio.replace(':', 'x')}.png`}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              <ImageIcon className="size-4" aria-hidden /> Poster frame
            </a>
            <a
              href={active.videoUrl}
              download={`${metadata.title || 'book'}-trailer-${active.aspectRatio.replace(':', 'x')}.mp4`}
              className={buttonClasses({ variant: 'primary', size: 'sm' })}
            >
              <Download className="size-4" aria-hidden /> Download MP4
            </a>
          </div>
        </div>
      </div>

      {/* Side Information Panel */}
      <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
        <Card className="flex flex-col gap-4 p-5">
          <h3 className="font-display text-base font-semibold">Recommended Placements</h3>
          <p className="text-xs text-ink-muted">
            Optimized for maximum engagement across these channels:
          </p>
          <ul className="flex flex-col gap-2">
            {details.bestFor.map((platform) => (
              <li
                key={platform}
                className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-xs font-medium text-ink"
              >
                <span className="size-1.5 rounded-full bg-accent" />
                {platform}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h3 className="font-display text-base font-semibold">Trailer Specs</h3>
          <dl className="grid grid-cols-2 gap-y-3 text-xs">
            <dt className="text-ink-muted">Style</dt>
            <dd className="font-medium capitalize text-right">{metadata.style}</dd>
            <dt className="text-ink-muted">Music Mood</dt>
            <dd className="font-medium capitalize text-right">{metadata.musicMood}</dd>
            <dt className="text-ink-muted">Pacing</dt>
            <dd className="font-medium text-right">{metadata.length}</dd>
            <dt className="text-ink-muted">Video Codec</dt>
            <dd className="font-medium text-right">H.264 (AVC)</dd>
            <dt className="text-ink-muted">Audio Codec</dt>
            <dd className="font-medium text-right">AAC 44.1kHz</dd>
          </dl>
        </Card>
      </aside>
    </div>
  )
}
