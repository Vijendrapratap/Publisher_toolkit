import { Easing, interpolate, useCurrentFrame } from 'remotion'
import { fitFontSize } from '@/components/trailer/remotion/fit'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Numbers in the accent colour: "120 cases" reads as proof at a glance. */
function withAccent(line: string, accent: string) {
  return line.split(/(\d[\d,.]*\+?)/).map((part, i) => (/^\d/.test(part) ? <span key={i} style={{ color: accent }}>{part}</span> : part))
}

/** Each line rises and fades in, a beat apart; everything fades out over the last 10 frames. */
export function BeatText({
  text,
  frames,
  font,
  color,
  accent,
  size,
  align = 'left',
  delay = 6,
  uppercase = false,
}: {
  text: string
  frames: number
  font: string
  color: string
  accent: string
  size: number
  align?: 'left' | 'center'
  delay?: number
  uppercase?: boolean
}) {
  const frame = useCurrentFrame()
  const lines = text.split('\n')
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '')
  return (
    <div
      style={{
        fontFamily: font,
        color,
        fontSize: fitFontSize(size, longest, 18),
        fontWeight: 700,
        lineHeight: 1.12,
        textAlign: align,
        textTransform: uppercase ? 'uppercase' : undefined,
        letterSpacing: uppercase ? '0.04em' : undefined,
        textShadow: '0 2px 24px rgba(0,0,0,0.45)',
        opacity: interpolate(frame, [frames - 10, frames], [1, 0], clamp),
      }}
    >
      {lines.map((line, i) => {
        const start = delay + i * 7
        const p = interpolate(frame, [start, start + 16], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })
        return (
          <div key={i} style={{ opacity: p, translate: `0 ${(1 - p) * 30}px` }}>
            {withAccent(line, accent)}
          </div>
        )
      })}
    </div>
  )
}
