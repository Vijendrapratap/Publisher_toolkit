import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { adFontFamily } from './fonts'
import { fitFontSize } from './fit'

export interface AiCaptionProps {
  [key: string]: unknown
  spec: AdVideoSpec
  caption: string
}

/** A transparent caption layer that ffmpeg lays over an AI clip. */
export function AiCaption({ spec, caption }: AiCaptionProps) {
  const { width, height } = useVideoConfig()
  const scale = Math.min(width, height) / 1080
  const { accent, text } = spec.style.colors
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: 80 * scale }}>
      <div
        style={{
          maxWidth: '86%',
          padding: `${18 * scale}px ${36 * scale}px`,
          borderRadius: 24 * scale,
          background: 'rgba(0, 0, 0, 0.55)',
          borderLeft: `${6 * scale}px solid ${accent}`,
          color: text,
          fontFamily: adFontFamily(spec.style.font),
          fontWeight: 700,
          fontSize: fitFontSize(64 * scale, caption, 24),
          lineHeight: 1.15,
          textAlign: 'center',
        }}
      >
        {caption}
      </div>
    </AbsoluteFill>
  )
}

export interface AiEndCardProps {
  [key: string]: unknown
  spec: AdVideoSpec
  coverUrl: string | null
  headline: string
  cta: string
}

/** The closing card: the real cover and real text, never drawn by the video model. */
export function AiEndCard({ spec, coverUrl, headline, cta }: AiEndCardProps) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const scale = Math.min(width, height) / 1080
  const isRow = width >= height
  const shown = spring({ frame, fps, config: { damping: 16 } })
  const { bgFrom, bgTo, accent, text } = spec.style.colors
  const family = adFontFamily(spec.style.font)
  const coverH = Math.round(height * (isRow ? 0.62 : 0.42))

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`,
        flexDirection: isRow ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 60 * scale,
        padding: 60 * scale,
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
      }}
    >
      {coverUrl && (
        <Img
          src={coverUrl}
          style={{
            height: coverH,
            width: Math.round((coverH * 2) / 3),
            objectFit: 'cover',
            borderRadius: 12 * scale,
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8)',
            transform: `scale(${interpolate(shown, [0, 1], [0.9, 1])})`,
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isRow ? 'flex-start' : 'center',
          textAlign: isRow ? 'left' : 'center',
          maxWidth: isRow ? '45%' : '86%',
          gap: 28 * scale,
          opacity: shown,
        }}
      >
        <div style={{ color: text, fontFamily: family, fontWeight: 700, fontSize: fitFontSize(64 * scale, headline, 28), lineHeight: 1.15 }}>
          {headline}
        </div>
        <div style={{ padding: `${16 * scale}px ${36 * scale}px`, borderRadius: 999, background: accent, color: bgTo, fontFamily: family, fontWeight: 700, fontSize: Math.round(34 * scale) }}>
          {cta}
        </div>
      </div>
    </AbsoluteFill>
  )
}
