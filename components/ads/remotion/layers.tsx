import { AbsoluteFill, Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Particle, StoryboardTheme } from '@/lib/services/ads/storyboard'

/** The setting (or a soft palette glow), pushing in slowly across the whole video. */
export function Backdrop({ settingUrl, palette }: { settingUrl: string | null; palette: StoryboardTheme['palette'] }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const scale = interpolate(frame, [0, durationInFrames], [1.02, 1.14])
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 68% 38%, ${palette.accent}40, ${palette.bg} 62%)` }}>
      {settingUrl && <Img src={settingUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', scale: String(scale) }} />}
      {settingUrl && <AbsoluteFill style={{ background: `${palette.bg}59` }} />}
    </AbsoluteFill>
  )
}

const COUNT: Record<Particle, number> = { leaves: 16, snow: 70, dust: 36, embers: 30, none: 0 }
const LEAF_COLOURS = ['#c2410c', '#d97706', '#b45309', '#9a3412', '#ca8a04']

/** Deterministic drifting particles; `random(seed)` keeps every render identical. */
export function Particles({ kind, accent }: { kind: Particle; accent: string }) {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const t = frame / fps
  const unit = Math.min(width, height)
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: COUNT[kind] }, (_, i) => {
        const r = (k: string) => random(`${kind}-${i}-${k}`)
        const falls = kind === 'leaves' || kind === 'snow'
        const speed = (kind === 'leaves' ? 0.09 : kind === 'snow' ? 0.07 : 0.025) * (0.6 + r('s') * 0.8)
        const p = (r('o') + t * speed) % 1
        const y = (falls ? -0.1 + p * 1.2 : 1.1 - p * 1.2) * height
        const x = (r('x') + Math.sin(t * (0.6 + r('w')) + i) * 0.025) * width
        const size = unit * (kind === 'leaves' ? 0.022 + r('z') * 0.018 : kind === 'snow' ? 0.004 + r('z') * 0.006 : 0.003 + r('z') * 0.005)
        const flicker = 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + i))
        const style: React.CSSProperties =
          kind === 'leaves'
            ? { width: size * 1.4, height: size, borderRadius: '60% 0', background: LEAF_COLOURS[i % LEAF_COLOURS.length], rotate: `${t * 70 * (r('d') > 0.5 ? 1 : -1) + r('a') * 360}deg`, opacity: 0.9 }
            : kind === 'snow'
              ? { width: size, height: size, borderRadius: '50%', background: '#fff', opacity: 0.85, filter: 'blur(1px)' }
              : kind === 'embers'
                ? { width: size, height: size, borderRadius: '50%', background: accent, opacity: flicker, boxShadow: `0 0 ${size * 3}px ${accent}` }
                : { width: size, height: size, borderRadius: '50%', background: '#fff8e7', opacity: flicker * 0.5, filter: 'blur(1.5px)' }
        return <div key={i} style={{ position: 'absolute', left: x, top: y, ...style }} />
      })}
    </AbsoluteFill>
  )
}

export function Vignette() {
  return <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)', pointerEvents: 'none' }} />
}

/** Film grain: SVG noise reseeded every other frame. */
export function Grain() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <svg width="100%" height="100%">
        <filter id="ad-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(frame / 2)} />
        </filter>
        <rect width="100%" height="100%" filter="url(#ad-grain)" />
      </svg>
    </AbsoluteFill>
  )
}
