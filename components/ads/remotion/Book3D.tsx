import { Img } from 'remotion'
import { BOOK_RATIO } from './layout'

/**
 * The real cover as a book: spine, page edge, contact shadow. `open` (0–1) swings the cover
 * open on its spine to show `leftPageUrl` / `rightPageUrl`; the spread stays centred.
 */
export function Book3D({
  coverUrl,
  leftPageUrl = null,
  rightPageUrl = null,
  height,
  turn = 0,
  open = 0,
  spine,
  title,
}: {
  coverUrl: string | null
  leftPageUrl?: string | null
  rightPageUrl?: string | null
  height: number
  turn?: number
  open?: number
  spine: string
  title: string
}) {
  const width = height * BOOK_RATIO
  const depth = height * 0.055
  const shift = (width / 2) * open
  const paper = '#f6f1e6'
  const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', overflow: 'hidden' }
  const pageImg: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' }
  return (
    <div style={{ position: 'relative', width, height, perspective: height * 3.2 }}>
      <div
        style={{
          position: 'absolute',
          left: width * 0.08 - shift * 0.5,
          right: -width * 0.06 - shift * 1.5,
          bottom: -height * 0.05,
          height: height * 0.08,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%)',
          filter: `blur(${height * 0.02}px)`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateX(${shift}px) rotateY(${turn * (1 - open)}deg)` }}>
        <div style={{ ...face, background: paper, transform: `translateZ(${-depth}px)`, boxShadow: '0 30px 60px rgba(0,0,0,0.45)' }}>
          {rightPageUrl && <Img src={rightPageUrl} style={pageImg} />}
        </div>
        <div style={{ position: 'absolute', top: 0, left: -depth / 2, width: depth, height, background: spine, transform: `translateZ(${-depth / 2}px) rotateY(90deg)` }} />
        <div
          style={{
            position: 'absolute',
            top: height * 0.012,
            left: width - depth / 2,
            width: depth,
            height: height * 0.976,
            background: 'repeating-linear-gradient(90deg, #efe8d8 0 2px, #d6ceb9 2px 3px)',
            transform: `translateZ(${-depth / 2}px) rotateY(90deg)`,
          }}
        />
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transformOrigin: 'left center', transform: `rotateY(${-172 * open}deg)` }}>
          <div style={{ ...face, borderRadius: `${height * 0.004}px ${height * 0.01}px ${height * 0.01}px ${height * 0.004}px`, boxShadow: 'inset 8px 0 14px rgba(0,0,0,0.35)', background: spine }}>
            {coverUrl ? (
              <Img src={coverUrl} style={pageImg} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: width * 0.1, color: '#fff', fontSize: height * 0.06, fontWeight: 700, textAlign: 'center' }}>
                {title}
              </div>
            )}
          </div>
          <div style={{ ...face, background: paper, transform: 'rotateY(180deg)' }}>{leftPageUrl && <Img src={leftPageUrl} style={pageImg} />}</div>
        </div>
      </div>
    </div>
  )
}
