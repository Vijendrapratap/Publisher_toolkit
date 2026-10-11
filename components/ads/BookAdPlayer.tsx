'use client'
import { useEffect, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { Film, RotateCcw } from 'lucide-react'
import { BookAd, type BookAdProps } from '@/components/ads/remotion/BookAd'
import { beatStartFrames, storyboardDurationInFrames } from '@/lib/services/ads/storyboard'
import { FPS, musicUrl, resolveMusic, videoDimensions } from '@/lib/services/ads/videoSpec'

export const BEAT_LABELS = {
  hook: 'Opening line',
  titleCard: 'Title card',
  pageZoom: 'Page close-up',
  bookOpen: 'Book opens',
  proof: 'Proof',
  audience: 'Who it’s for',
  endCard: 'End card',
} as const

const STAGE_MAX_WIDTH = { '9:16': 300 } as Record<string, number>

/** The same BookAd composition the export renders, so the preview is the video. */
export function BookAdPlayer(props: Pick<BookAdProps, 'spec' | 'storyboard' | 'title' | 'author' | 'coverUrl' | 'pageUrls' | 'settingUrl'>) {
  const [mounted, setMounted] = useState(false)
  const ref = useRef<PlayerRef>(null)
  useEffect(() => setMounted(true), [])
  const { width, height } = videoDimensions(props.spec.format)
  const beats = props.storyboard.beats
  const starts = beatStartFrames(beats)
  const seek = (frame: number) => {
    ref.current?.seekTo(frame)
    ref.current?.play()
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid place-items-center rounded-2xl bg-black p-3 sm:p-4">
        <div className="w-full" style={{ maxWidth: STAGE_MAX_WIDTH[props.spec.format], aspectRatio: `${width} / ${height}` }}>
          {mounted ? (
            <Player
              ref={ref}
              component={BookAd}
              inputProps={{ ...props, musicSrc: musicUrl(resolveMusic(props.spec)) }}
              durationInFrames={storyboardDurationInFrames(beats)}
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
        {beats.map((beat, i) => (
          <button
            key={i}
            type="button"
            onClick={() => seek(starts[i] + 8)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-accent/50 hover:text-ink"
          >
            {i + 1}. {BEAT_LABELS[beat.kind]}
          </button>
        ))}
        <button type="button" onClick={() => seek(0)} className="ml-auto inline-flex items-center gap-1 text-xs text-ink-muted transition hover:text-ink">
          <RotateCcw className="size-3" aria-hidden /> Replay
        </button>
      </div>
    </div>
  )
}
