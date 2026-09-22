'use client'

import { useEffect, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { Film, RotateCcw } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import {
  BookTrailerComposition,
  type BookTrailerCompositionProps,
} from './remotion/BookTrailerComposition'
import { FPS, musicUrl, resolveMusic, videoDimensions, videoDurationInFrames, type AdVideoSpec } from '@/lib/services/ads/videoSpec'

export interface TrailerLivePreviewPlayerProps {
  spec: AdVideoSpec
  title: string
  author: string
  coverUrl?: string | null
  interiorImageUrls?: string[]
  className?: string
}

const SCENES = ['Hook', 'Story', 'Book', 'Call to action']

/** Stage width per format, so a vertical video is not blown up to the column width. */
const STAGE_MAX_WIDTH: Record<AdVideoSpec['format'], number> = { '9:16': 300, '1:1': 460, '16:9': 680 }

export function TrailerLivePreviewPlayer({ spec, title, author, coverUrl, interiorImageUrls, className }: TrailerLivePreviewPlayerProps) {
  const [mounted, setMounted] = useState(false)
  const playerRef = useRef<PlayerRef>(null)
  useEffect(() => setMounted(true), [])

  const { width, height } = videoDimensions(spec.format)
  const durationInFrames = videoDurationInFrames(spec)
  const sceneFrames = Math.floor(durationInFrames / SCENES.length)
  const inputProps: BookTrailerCompositionProps = { spec, title, author, coverUrl, interiorImageUrls, musicSrc: musicUrl(resolveMusic(spec)) }

  const seek = (frame: number) => {
    playerRef.current?.seekTo(frame)
    playerRef.current?.play()
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="grid place-items-center rounded-2xl bg-black p-3 sm:p-4">
        <div className="w-full" style={{ maxWidth: STAGE_MAX_WIDTH[spec.format], aspectRatio: `${width} / ${height}` }}>
          {mounted ? (
            <Player<any, BookTrailerCompositionProps>
              ref={playerRef}
              component={BookTrailerComposition}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={FPS}
              compositionWidth={width}
              compositionHeight={height}
              style={{ width: '100%', height: '100%' }}
              controls
              loop
            />
          ) : (
            <div className="grid size-full place-items-center text-white/40">
              <Film className="size-8" aria-hidden />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {SCENES.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => seek(i * sceneFrames)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-accent/50 hover:text-ink"
          >
            {i + 1}. {name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => seek(0)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-ink-muted transition hover:text-ink"
        >
          <RotateCcw className="size-3" aria-hidden /> Replay
        </button>
      </div>
    </div>
  )
}
