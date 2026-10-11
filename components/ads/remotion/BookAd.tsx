'use client'
import { AbsoluteFill, Audio, interpolate, useVideoConfig } from 'remotion'
import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { slide } from '@remotion/transitions/slide'
import { wipe } from '@remotion/transitions/wipe'
import { TRANSITION_FRAMES, beatFrames, type Storyboard } from '@/lib/services/ads/storyboard'
import type { AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { adFontFamily } from '@/components/trailer/remotion/fonts'
import { Backdrop, Grain, Particles, Vignette } from './layers'
import { Scene, type AdCtx } from './scenes'
import { textSizeFor, transitionFor, type TransitionKind } from './layout'

export interface BookAdProps {
  [key: string]: unknown
  spec: AdVideoSpec
  storyboard: Storyboard
  title: string
  author: string
  coverUrl: string | null
  /** Index 0 is page 1; pages the storyboard does not show may be null. */
  pageUrls: (string | null)[]
  settingUrl: string | null
  musicSrc?: string | null
}

// Each presentation has its own props type; the series only needs them as one kind.
const PRESENTATIONS = {
  fade: fade(),
  slide: slide({ direction: 'from-right' }),
  wipe: wipe({ direction: 'from-left' }),
} as Record<TransitionKind, TransitionPresentation<Record<string, unknown>>>

export function BookAd({ storyboard, title, coverUrl, pageUrls, settingUrl, musicSrc }: BookAdProps) {
  const { width, height, fps, durationInFrames } = useVideoConfig()
  const { theme, beats } = storyboard
  const ctx: AdCtx = { width, height, theme, font: adFontFamily(theme.font), textSize: textSizeFor(width, height), coverUrl, pageUrls, title }
  const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES })
  return (
    <AbsoluteFill style={{ background: theme.palette.bg }}>
      <Backdrop settingUrl={settingUrl} palette={theme.palette} />
      <TransitionSeries>
        {beats.flatMap((beat, i) => {
          const sequence = (
            <TransitionSeries.Sequence key={`beat-${i}`} name={beat.kind} durationInFrames={beatFrames(beat)} premountFor={fps}>
              <Scene beat={beat} frames={beatFrames(beat)} ctx={ctx} />
            </TransitionSeries.Sequence>
          )
          if (i === 0) return [sequence]
          return [
            <TransitionSeries.Transition key={`cut-${i}`} presentation={PRESENTATIONS[transitionFor(beats[i - 1].kind, beat.kind)]} timing={timing} />,
            sequence,
          ]
        })}
      </TransitionSeries>
      <Particles kind={theme.particles} accent={theme.palette.accent} />
      <Vignette />
      <Grain />
      {musicSrc && (
        <Audio
          src={musicSrc}
          loop
          volume={(f) => interpolate(f, [0, fps / 2, durationInFrames - fps, durationInFrames], [0, 0.8, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </AbsoluteFill>
  )
}
