import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Beat, BeatOf, StoryboardTheme } from '@/lib/services/ads/storyboard'
import { Book3D } from './Book3D'
import { BeatText } from './BeatText'
import { stageLayout } from './layout'

export interface AdCtx {
  width: number
  height: number
  theme: StoryboardTheme
  font: string
  textSize: number
  coverUrl: string | null
  pageUrls: (string | null)[]
  title: string
}
interface SceneProps<K extends Beat['kind']> {
  beat: BeatOf<K>
  frames: number
  ctx: AdCtx
}
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.bezier(0.45, 0, 0.55, 1)

/** Book on one side, the line on the other: hook, proof and audience share it. */
function BookAndLine({ side, text, frames, ctx, pageUrl }: { side: 'left' | 'right'; text: string; frames: number; ctx: AdCtx; pageUrl?: string | null }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { book, text: box, stacked } = stageLayout(ctx.width, ctx.height, side)
  const enter = spring({ frame, fps, config: { damping: 200 } })
  const turn = interpolate(frame, [0, frames], [16, 6]) * (side === 'left' ? -1 : 1)
  const float = Math.sin(frame / 20) * ctx.height * 0.006
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: book.x, top: book.y + float + (1 - enter) * ctx.height * 0.04, opacity: enter }}>
        {pageUrl ? (
          <Img src={pageUrl} style={{ height: book.h, width: book.w, objectFit: 'cover', rotate: `${side === 'left' ? 3 : -3}deg`, boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }} />
        ) : (
          <Book3D coverUrl={ctx.coverUrl} height={book.h} turn={turn} spine={ctx.theme.palette.bg} accent={ctx.theme.palette.accent} title={ctx.title} />
        )}
      </div>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, display: 'flex', alignItems: 'center', justifyContent: stacked ? 'center' : 'flex-start' }}>
        <BeatText text={text} frames={frames} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.accent} size={ctx.textSize} align={stacked ? 'center' : 'left'} />
      </div>
    </AbsoluteFill>
  )
}

export function HookScene({ beat, frames, ctx }: SceneProps<'hook'>) {
  return <BookAndLine side={beat.side} text={beat.text} frames={frames} ctx={ctx} />
}

export function ProofScene({ beat, frames, ctx }: SceneProps<'proof'>) {
  return <BookAndLine side="left" text={beat.text} frames={frames} ctx={ctx} pageUrl={beat.page ? ctx.pageUrls[beat.page - 1] : null} />
}

export function AudienceScene({ beat, frames, ctx }: SceneProps<'audience'>) {
  return <BookAndLine side="right" text={beat.text} frames={frames} ctx={ctx} />
}

/** A trailer card: dark, one sentence, the cover pinned small in the corner when asked. */
export function TitleCardScene({ beat, frames, ctx }: SceneProps<'titleCard'>) {
  const frame = useCurrentFrame()
  const dark = interpolate(frame, [0, 8], [0.4, 0.86], clamp)
  return (
    <AbsoluteFill style={{ background: `rgba(8,8,10,${dark})`, alignItems: 'center', justifyContent: 'center', padding: ctx.width * 0.1 }}>
      {ctx.theme.cornerCover && ctx.coverUrl && (
        <Img src={ctx.coverUrl} style={{ position: 'absolute', left: ctx.width * 0.03, top: ctx.height * 0.04, height: ctx.height * 0.16, boxShadow: '0 8px 20px rgba(0,0,0,0.6)' }} />
      )}
      <BeatText text={beat.text} frames={frames} font={ctx.font} color="#f5f1e8" accent={ctx.theme.palette.accent} size={ctx.textSize * 0.78} align="center" />
    </AbsoluteFill>
  )
}

/** The page fills the frame; the camera moves in on the part that proves the caption. */
export function PageZoomScene({ beat, frames, ctx }: SceneProps<'pageZoom'>) {
  const frame = useCurrentFrame()
  const url = ctx.pageUrls[beat.page - 1]
  if (!url) return <BookAndLine side="left" text={beat.text ?? ctx.title} frames={frames} ctx={ctx} />
  const progress = interpolate(frame, [0, frames], [0, 1], { ...clamp, easing: ease })
  const scale = 1 + (beat.focus.zoom - 1) * progress
  const portrait = ctx.height > ctx.width
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle, ${ctx.theme.palette.bg}e6, ${ctx.theme.palette.bg})`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Img
        src={url}
        style={{
          // Fits single pages and wide spreads alike, so the zoom starts from the whole page.
          maxWidth: ctx.width * (portrait ? 0.92 : 0.86),
          maxHeight: ctx.height * (portrait ? 0.8 : 0.9),
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          transformOrigin: `${beat.focus.x * 100}% ${beat.focus.y * 100}%`,
          scale: String(scale),
        }}
      />
      {beat.text && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: `${ctx.height * 0.035}px ${ctx.width * 0.06}px`, background: `${ctx.theme.palette.bg}e6`, display: 'flex', justifyContent: 'center' }}>
          <BeatText text={beat.text} frames={frames} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.accent} size={ctx.textSize * 0.55} align="center" uppercase />
        </div>
      )}
    </AbsoluteFill>
  )
}

/** The book swings open on two real pages, then the camera eases in. */
export function BookOpenScene({ beat, frames, ctx }: SceneProps<'bookOpen'>) {
  const frame = useCurrentFrame()
  const portrait = ctx.height > ctx.width
  const h = ctx.height * (portrait ? 0.34 : 0.7)
  const w = h * 0.68
  const open = interpolate(frame, [8, frames * 0.5], [0, 1], { ...clamp, easing: ease })
  const push = interpolate(frame, [0, frames], [1, 1.08], clamp)
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', left: ctx.width / 2 - w / 2 - (w / 2) * open, top: (ctx.height - h) / 2 - (beat.text ? ctx.height * 0.05 : 0), scale: String(push) }}>
        <Book3D coverUrl={ctx.coverUrl} height={h} turn={-12} open={open} spine={ctx.theme.palette.bg} accent={ctx.theme.palette.accent} title={ctx.title} leftPageUrl={ctx.pageUrls[beat.page - 1] ?? null} rightPageUrl={ctx.pageUrls[beat.page] ?? null} />
      </div>
      {beat.text && (
        <div style={{ position: 'absolute', left: ctx.width * 0.08, right: ctx.width * 0.08, bottom: ctx.height * 0.06, display: 'flex', justifyContent: 'center' }}>
          <BeatText text={beat.text} frames={frames} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.accent} size={ctx.textSize * 0.6} align="center" delay={Math.round(frames * 0.4)} />
        </div>
      )}
    </AbsoluteFill>
  )
}

/** Cover, title, series line and the button; the last frames match the opening so it loops. */
export function EndCardScene({ beat, frames, ctx }: SceneProps<'endCard'>) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { book, text: box, stacked } = stageLayout(ctx.width, ctx.height, 'right')
  const pop = spring({ frame: frame - 16, fps, config: { damping: 12, stiffness: 120 } })
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: book.x, top: book.y }}>
        <Book3D coverUrl={ctx.coverUrl} height={book.h} turn={interpolate(frame, [0, frames], [10, 4])} spine={ctx.theme.palette.bg} accent={ctx.theme.palette.accent} title={ctx.title} />
      </div>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: stacked ? 'center' : 'flex-start', gap: ctx.height * 0.025 }}>
        <BeatText text={beat.title} frames={frames + 30} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.ink} size={ctx.textSize * 0.82} align={stacked ? 'center' : 'left'} delay={4} />
        {beat.subtitle && (
          <BeatText text={beat.subtitle} frames={frames + 30} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.accent} size={ctx.textSize * 0.4} align={stacked ? 'center' : 'left'} delay={10} />
        )}
        <div style={{ scale: String(Math.max(0, pop)), fontFamily: ctx.font, fontWeight: 700, fontSize: ctx.textSize * 0.42, color: ctx.theme.palette.bg, background: ctx.theme.palette.accent, padding: `${ctx.textSize * 0.22}px ${ctx.textSize * 0.55}px`, borderRadius: 999, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
          {beat.cta}
        </div>
      </div>
    </AbsoluteFill>
  )
}

export function Scene({ beat, frames, ctx }: { beat: Beat; frames: number; ctx: AdCtx }) {
  switch (beat.kind) {
    case 'hook':
      return <HookScene beat={beat} frames={frames} ctx={ctx} />
    case 'titleCard':
      return <TitleCardScene beat={beat} frames={frames} ctx={ctx} />
    case 'pageZoom':
      return <PageZoomScene beat={beat} frames={frames} ctx={ctx} />
    case 'bookOpen':
      return <BookOpenScene beat={beat} frames={frames} ctx={ctx} />
    case 'proof':
      return <ProofScene beat={beat} frames={frames} ctx={ctx} />
    case 'audience':
      return <AudienceScene beat={beat} frames={frames} ctx={ctx} />
    case 'endCard':
      return <EndCardScene beat={beat} frames={frames} ctx={ctx} />
  }
}
