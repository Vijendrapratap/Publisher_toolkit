'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import {
  Sparkles,
  Smartphone,
  Square,
  Tv,
  Film,
  RotateCcw,
  Volume2,
} from 'lucide-react'
import { cn } from '@/components/ui/cn'
import {
  BookTrailerComposition,
  type BookTrailerCompositionProps,
} from './remotion/BookTrailerComposition'
import type {
  TrailerAspectRatio,
  TrailerMusicMood,
  TrailerStyle,
} from '@/lib/services/trailer/options'

export interface TrailerLivePreviewPlayerProps {
  title: string
  author: string
  blurb: string
  hookText?: string | null
  ctaText?: string | null
  style: TrailerStyle
  musicMood: TrailerMusicMood
  coverUrl?: string | null
  defaultAspectRatio?: TrailerAspectRatio
  className?: string
  interiorImageUrls?: string[]
}

interface AspectConfig {
  key: TrailerAspectRatio
  label: string
  sublabel: string
  icon: React.ElementType
  width: number
  height: number
  previewMaxHeight: number
  previewMaxWidth: number
}

const ASPECTS: AspectConfig[] = [
  {
    key: '9:16',
    label: '9:16 Vertical',
    sublabel: 'Reels / TikTok / Shorts',
    icon: Smartphone,
    width: 1080,
    height: 1920,
    previewMaxHeight: 520,
    previewMaxWidth: 292,
  },
  {
    key: '1:1',
    label: '1:1 Square',
    sublabel: 'Instagram / Feed',
    icon: Square,
    width: 1080,
    height: 1080,
    previewMaxHeight: 460,
    previewMaxWidth: 460,
  },
  {
    key: '16:9',
    label: '16:9 Widescreen',
    sublabel: 'YouTube / Website',
    icon: Tv,
    width: 1920,
    height: 1080,
    previewMaxHeight: 380,
    previewMaxWidth: 676,
  },
]

const SCENES = [
  { name: 'Scene 1: Hook', frame: 0, time: '0s' },
  { name: 'Scene 2: Story Excerpt', frame: 75, time: '2.5s' },
  { name: 'Scene 3: 3D Book Reveal', frame: 150, time: '5.0s' },
  { name: 'Scene 4: Outro CTA', frame: 225, time: '7.5s' },
]

export function TrailerLivePreviewPlayer({
  title,
  author,
  blurb,
  hookText,
  ctaText,
  style,
  musicMood,
  coverUrl,
  defaultAspectRatio = '9:16',
  className,
  interiorImageUrls,
}: TrailerLivePreviewPlayerProps) {
  const [mounted, setMounted] = useState(false)
  const [activeAspect, setActiveAspect] = useState<TrailerAspectRatio>(defaultAspectRatio)
  const playerRef = useRef<PlayerRef>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentConfig = ASPECTS.find((a) => a.key === activeAspect) ?? ASPECTS[0]
  const DURATION_FRAMES = 300 // 10 seconds at 30 fps
  const FPS = 30

  const jumpToScene = (frame: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(frame)
      playerRef.current.play()
    }
  }

  const restartPreview = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(0)
      playerRef.current.play()
    }
  }

  const inputProps: BookTrailerCompositionProps = {
    title,
    author,
    blurb,
    hookText,
    ctaText,
    style,
    musicMood,
    coverUrl,
    aspectRatio: activeAspect,
    interiorImageUrls,
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-line/70 bg-surface shadow-card',
        className
      )}
    >
      {/* Top Bar Header */}
      <div className="flex flex-col gap-3 border-b border-line/60 bg-surface-2/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Sparkles className="size-4 animate-pulse" aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Interactive Trailer Live Preview</span>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[10px] font-medium text-accent">
                Remotion 30fps
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Live interactive render showing real-time text & style updates
            </p>
          </div>
        </div>

        {/* Aspect Ratio Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-surface-3/60 p-1">
          {ASPECTS.map((aspect) => {
            const Icon = aspect.icon
            const isSelected = activeAspect === aspect.key
            return (
              <button
                key={aspect.key}
                type="button"
                onClick={() => setActiveAspect(aspect.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                  isSelected
                    ? 'bg-surface text-ink shadow-subtle ring-1 ring-accent/30 font-semibold'
                    : 'text-ink-muted hover:text-ink'
                )}
                title={aspect.sublabel}
              >
                <Icon className="size-3.5" aria-hidden />
                <span>{aspect.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Video Viewport Stage */}
      <div className="relative flex min-h-[380px] w-full items-center justify-center bg-black/95 p-4 sm:p-6 overflow-hidden">
        {/* Subtle stage ambient glow */}
        <div className="absolute inset-0 bg-radial from-accent/5 to-transparent pointer-events-none" />

        {!mounted ? (
          <div className="flex h-[360px] w-full max-w-[240px] animate-pulse flex-col items-center justify-center rounded-2xl border border-line/30 bg-surface-2/20 text-ink-muted">
            <Film className="size-8 opacity-40" />
            <span className="mt-2 text-xs">Loading Remotion player...</span>
          </div>
        ) : (
          <div
            className="relative flex items-center justify-center transition-all duration-300 ease-out"
            style={{
              width: '100%',
              maxWidth: `${currentConfig.previewMaxWidth}px`,
              aspectRatio: `${currentConfig.width} / ${currentConfig.height}`,
              maxHeight: `${currentConfig.previewMaxHeight}px`,
            }}
          >
            {/* Device frame border styling for vertical phone */}
            <div
              className={cn(
                'relative w-full h-full overflow-hidden bg-black shadow-2xl transition-all',
                activeAspect === '9:16'
                  ? 'rounded-[28px] ring-1 ring-white/20 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.9)]'
                  : 'rounded-xl ring-1 ring-white/10'
              )}
            >
              <Player<any, BookTrailerCompositionProps>
                ref={playerRef}
                component={BookTrailerComposition}
                inputProps={inputProps}
                durationInFrames={DURATION_FRAMES}
                fps={FPS}
                compositionWidth={currentConfig.width}
                compositionHeight={currentConfig.height}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                controls
                loop
                autoPlay={false}
              />
            </div>
          </div>
        )}
      </div>

      {/* Scene Navigation & Narrative Beats */}
      <div className="flex flex-col gap-2.5 border-t border-line/60 bg-surface-2/30 px-5 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Film className="size-3.5 text-accent" aria-hidden />
            <span className="font-medium text-ink">Narrative Beats:</span>
            <span>Jump directly to preview individual scenes:</span>
          </div>

          <button
            type="button"
            onClick={restartPreview}
            className="flex items-center gap-1 self-start sm:self-auto text-xs text-ink-muted hover:text-accent transition-colors"
          >
            <RotateCcw className="size-3" aria-hidden />
            <span>Replay from Start</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SCENES.map((s, idx) => (
            <button
              key={s.name}
              type="button"
              onClick={() => jumpToScene(s.frame)}
              className="flex items-center justify-between rounded-xl border border-line/60 bg-surface px-3 py-2 text-left text-xs transition-all hover:border-accent/60 hover:bg-accent-soft/20 group"
            >
              <div className="flex flex-col">
                <span className="font-semibold group-hover:text-accent transition-colors">
                  Beat {idx + 1}
                </span>
                <span className="text-[11px] text-ink-muted truncate">{s.name.split(': ')[1]}</span>
              </div>
              <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                {s.time}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/40 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1">
            <Volume2 className="size-3 text-accent" aria-hidden />
            Soundtrack Mood: <strong className="text-ink capitalize">{musicMood}</strong>
          </span>
          <span>
            Selected Style: <strong className="text-ink capitalize">{style}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}
