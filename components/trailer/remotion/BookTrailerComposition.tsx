'use client'
import React from 'react'
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion'
import type {
  TrailerAspectRatio,
  TrailerMusicMood,
  TrailerStyle,
} from '@/lib/services/trailer/options'

export interface BookTrailerCompositionProps {
  [key: string]: unknown
  title: string
  author: string
  blurb: string
  hookText?: string | null
  ctaText?: string | null
  style: TrailerStyle
  musicMood: TrailerMusicMood
  coverUrl?: string | null
  aspectRatio: TrailerAspectRatio
}

interface Palette {
  bgGradient: [string, string, string]
  accent: string
  textPrimary: string
  textSecondary: string
  fontFamily: string
}

const PALETTES: Record<TrailerStyle, Palette> = {
  fantasy: {
    bgGradient: ['#28150a', '#170b05', '#080301'],
    accent: '#f59e0b',
    textPrimary: '#fef08a',
    textSecondary: '#fed7aa',
    fontFamily: 'serif',
  },
  thriller: {
    bgGradient: ['#0d0407', '#1c060d', '#080204'],
    accent: '#ef4444',
    textPrimary: '#ffffff',
    textSecondary: '#fca5a5',
    fontFamily: 'sans-serif',
  },
  scifi: {
    bgGradient: ['#050a18', '#0b1633', '#03060f'],
    accent: '#06b6d4',
    textPrimary: '#e0f2fe',
    textSecondary: '#93c5fd',
    fontFamily: 'sans-serif',
  },
  romance: {
    bgGradient: ['#1c0a14', '#2c1020', '#0f050b'],
    accent: '#fb7185',
    textPrimary: '#ffe4e6',
    textSecondary: '#fbcfe8',
    fontFamily: 'serif',
  },
  cinematic: {
    bgGradient: ['#07070a', '#181420', '#0a080d'],
    accent: '#d97706',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    fontFamily: 'serif',
  },
  dramatic: {
    bgGradient: ['#0a0507', '#220812', '#0d0407'],
    accent: '#f43f5e',
    textPrimary: '#ffffff',
    textSecondary: '#fecdd3',
    fontFamily: 'sans-serif',
  },
  minimal: {
    bgGradient: ['#0b1120', '#132338', '#0f172a'],
    accent: '#38bdf8',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    fontFamily: 'sans-serif',
  },
  energetic: {
    bgGradient: ['#15092a', '#3b0764', '#1f0d3d'],
    accent: '#c084fc',
    textPrimary: '#ffffff',
    textSecondary: '#e9d5ff',
    fontFamily: 'sans-serif',
  },
}

// Background layer with atmospheric lighting & style overlays
function AnimatedBackground({
  palette,
  style,
  scale,
}: {
  palette: Palette
  style: TrailerStyle
  scale: number
}) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()

  // Slow ambient breathing zoom
  const bgScale = interpolate(frame, [0, 900], [1, 1.08], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${palette.bgGradient[0]} 0%, ${palette.bgGradient[1]} 50%, ${palette.bgGradient[2]} 100%)`,
        overflow: 'hidden',
        transform: `scale(${bgScale})`,
      }}
    >
      {/* Dark radial vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at center, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.65) 85%)',
        }}
      />

      {/* Style-specific dynamic overlays */}
      {style === 'fantasy' && (
        <>
          {/* Fantasy Double Border */}
          <div
            style={{
              position: 'absolute',
              inset: 40 * scale,
              border: '2px solid rgba(217, 119, 6, 0.5)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 52 * scale,
              border: '1px solid rgba(245, 158, 11, 0.3)',
              pointerEvents: 'none',
            }}
          />
          {/* Floating animated embers */}
          {Array.from({ length: 24 }).map((_, i) => {
            const startX = ((i * 173 + 31) % 1000) / 1000 * width
            const speed = 1.2 + (i % 5) * 0.4
            const yOffset = (frame * speed * 2 + i * 80) % (height + 100)
            const curY = height - yOffset
            const curX = startX + Math.sin(frame * 0.05 + i) * 15 * scale
            const size = (3 + (i % 4) * 2) * scale
            const opacity = interpolate(
              curY,
              [0, height * 0.3, height * 0.8, height],
              [0, 0.85, 0.85, 0]
            )

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: curX,
                  top: curY,
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: i % 2 === 0 ? '#fef08a' : '#f97316',
                  boxShadow: '0 0 10px #f59e0b',
                  opacity,
                  pointerEvents: 'none',
                }}
              />
            )
          })}
        </>
      )}

      {style === 'scifi' && (
        <>
          {/* Cyan scanlines */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(6, 182, 212, 0.04) 1px, transparent 1px)',
              backgroundSize: `100% ${Math.max(6, 10 * scale)}px`,
              pointerEvents: 'none',
            }}
          />
          {/* Tech Corner HUD */}
          <div
            style={{
              position: 'absolute',
              top: 36 * scale,
              left: 36 * scale,
              width: 50 * scale,
              height: 50 * scale,
              borderTop: '2.5px solid #06b6d4',
              borderLeft: '2.5px solid #06b6d4',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 36 * scale,
              right: 36 * scale,
              width: 50 * scale,
              height: 50 * scale,
              borderTop: '2.5px solid #06b6d4',
              borderRight: '2.5px solid #06b6d4',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 36 * scale,
              left: 36 * scale,
              width: 50 * scale,
              height: 50 * scale,
              borderBottom: '2.5px solid #06b6d4',
              borderLeft: '2.5px solid #06b6d4',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 36 * scale,
              right: 36 * scale,
              width: 50 * scale,
              height: 50 * scale,
              borderBottom: '2.5px solid #06b6d4',
              borderRight: '2.5px solid #06b6d4',
            }}
          />
        </>
      )}

      {style === 'romance' && (
        <>
          {/* Soft bokeh motes */}
          {Array.from({ length: 12 }).map((_, i) => {
            const bx = ((i * 181 + 47) % 1000) / 1000 * width
            const by = ((i * 269 + 83) % 1000) / 1000 * height
            const br = (40 + (i % 6) * 20) * scale
            const float = Math.sin(frame * 0.04 + i) * 12 * scale
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: bx - br / 2,
                  top: by + float - br / 2,
                  width: br,
                  height: br,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(251,113,133,0.18) 0%, rgba(251,113,133,0) 70%)',
                  pointerEvents: 'none',
                }}
              />
            )
          })}
          {/* Delicate rounded border */}
          <div
            style={{
              position: 'absolute',
              inset: 44 * scale,
              border: '1.5px solid rgba(251, 113, 133, 0.35)',
              borderRadius: 20 * scale,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {style === 'cinematic' && (
        <div
          style={{
            position: 'absolute',
            top: '46%',
            left: 0,
            right: 0,
            height: 16 * scale,
            background:
              'linear-gradient(90deg, rgba(217,119,6,0) 0%, rgba(217,119,6,0.15) 50%, rgba(217,119,6,0) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  )
}

function PillBadge({
  text,
  accent,
  scale,
}: {
  text: string
  accent: string
  scale: number
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${Math.round(8 * scale)}px ${Math.round(24 * scale)}px`,
        borderRadius: 9999,
        border: `1.5px solid ${accent}`,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        color: accent,
        fontSize: Math.max(13, Math.round(22 * scale)),
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </div>
  )
}

// Scene 1: The Hook
function Scene1({
  title,
  author,
  hookText,
  palette,
  style,
  scale,
  durationInFrames,
}: {
  title: string
  author: string
  hookText?: string | null
  palette: Palette
  style: TrailerStyle
  scale: number
  durationInFrames: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // In / out transition opacity
  const enterProgress = spring({ frame, fps, config: { damping: 15, mass: 0.8 } })
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const badgeY = interpolate(enterProgress, [0, 1], [-20, 0])
  const textScale = interpolate(frame, [0, durationInFrames], [0.96, 1.04], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  })

  const badgeLabel =
    style === 'fantasy'
      ? 'ANCIENT STORYBOOK'
      : style === 'thriller'
      ? 'OFFICIAL DOSSIER'
      : style === 'scifi'
      ? 'CLASSIFIED LOG'
      : 'OFFICIAL BOOK TRAILER'

  const mainHook = hookText || title || 'An Unforgettable Story'

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Math.max(30, 80 * scale),
        textAlign: 'center',
        opacity: exitOpacity,
      }}
    >
      <div style={{ transform: `translateY(${badgeY}px)`, opacity: enterProgress }}>
        <PillBadge text={badgeLabel} accent={palette.accent} scale={scale} />
      </div>

      <div
        style={{
          marginTop: Math.max(20, 50 * scale),
          maxWidth: '85%',
          color: palette.textPrimary,
          fontFamily: palette.fontFamily,
          fontSize: Math.max(32, Math.round(72 * scale)),
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          textShadow: '0 4px 24px rgba(0,0,0,0.8)',
          transform: `scale(${textScale})`,
          opacity: enterProgress,
        }}
      >
        {mainHook}
      </div>

      <div
        style={{
          marginTop: Math.max(16, 36 * scale),
          width: interpolate(enterProgress, [0, 1], [0, Math.max(60, 160 * scale)]),
          height: Math.max(3, 4 * scale),
          backgroundColor: palette.accent,
          borderRadius: 2,
        }}
      />

      <div
        style={{
          marginTop: Math.max(16, 36 * scale),
          color: palette.textSecondary,
          fontFamily: palette.fontFamily,
          fontStyle: 'italic',
          fontSize: Math.max(16, Math.round(36 * scale)),
          opacity: interpolate(frame, [15, 35], [0, 0.95], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          transform: `translateY(${interpolate(frame, [15, 35], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
        }}
      >
        {author ? `A Novel by ${author}` : 'Coming Soon to All Bookstores'}
      </div>
    </AbsoluteFill>
  )
}

// Scene 2: The Story / Excerpt
function Scene2({
  blurb,
  author,
  palette,
  scale,
  durationInFrames,
}: {
  blurb: string
  author: string
  palette: Palette
  scale: number
  durationInFrames: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enterProgress = spring({ frame, fps, config: { damping: 14 } })
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const cleanBlurb = blurb
    ? blurb.replace(/\n+/g, ' ').slice(0, 240)
    : 'Every page brings a new revelation. Dive into the world of an extraordinary tale.'

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Math.max(30, 90 * scale),
        textAlign: 'center',
        opacity: exitOpacity,
      }}
    >
      <div style={{ opacity: enterProgress }}>
        <PillBadge text="THE STORY" accent={palette.accent} scale={scale} />
      </div>

      <div
        style={{
          marginTop: Math.max(16, 32 * scale),
          fontSize: Math.max(48, Math.round(110 * scale)),
          fontFamily: 'Georgia, serif',
          fontWeight: 700,
          color: palette.accent,
          lineHeight: 0.8,
          opacity: enterProgress,
        }}
      >
        “
      </div>

      <div
        style={{
          marginTop: Math.max(12, 24 * scale),
          maxWidth: '82%',
          color: palette.textPrimary,
          fontFamily: palette.fontFamily,
          fontStyle: 'italic',
          fontSize: Math.max(20, Math.round(44 * scale)),
          lineHeight: 1.4,
          opacity: enterProgress,
          transform: `translateY(${interpolate(enterProgress, [0, 1], [25, 0])}px)`,
        }}
      >
        {cleanBlurb}
      </div>

      {author && (
        <div
          style={{
            marginTop: Math.max(18, 44 * scale),
            fontSize: Math.max(16, Math.round(30 * scale)),
            fontWeight: 600,
            color: palette.accent,
            opacity: interpolate(frame, [20, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          — {author}
        </div>
      )}
    </AbsoluteFill>
  )
}

// Scene 3: Hero 3D Book Reveal
function Scene3({
  title,
  author,
  coverUrl,
  palette,
  scale,
  durationInFrames,
  isWidescreen,
}: {
  title: string
  author: string
  coverUrl?: string | null
  palette: Palette
  scale: number
  durationInFrames: number
  isWidescreen: boolean
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enterProgress = spring({ frame, fps, config: { damping: 16 } })
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Subtle 3D rotation & Ken Burns scale
  const bookScale = interpolate(frame, [0, durationInFrames], [0.94, 1.05])
  const bookRotateY = interpolate(frame, [0, durationInFrames], [-6, 5])

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: isWidescreen ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isWidescreen ? Math.max(30, 80 * scale) : Math.max(20, 40 * scale),
        padding: Math.max(24, 60 * scale),
        opacity: exitOpacity,
      }}
    >
      {/* 3D Book Cover Presentation */}
      <div
        style={{
          perspective: 1000,
          opacity: enterProgress,
          transform: `scale(${bookScale})`,
        }}
      >
        <div
          style={{
            transform: `rotateY(${bookRotateY}deg) rotateX(2deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.1s ease-out',
            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.85), 0 0 40px rgba(0,0,0,0.4)',
            borderRadius: Math.max(6, 16 * scale),
            overflow: 'hidden',
          }}
        >
          {coverUrl ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt=""
                style={{
                  width: isWidescreen ? 360 * scale : 420 * scale,
                  height: isWidescreen ? 540 * scale : 630 * scale,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              {/* Dynamic hyperframe specular catchlight sweep */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(${110 + bookRotateY * 3}deg, transparent ${25 + bookRotateY * 3}%, rgba(255,255,255,0.22) ${45 + bookRotateY * 3}%, transparent ${60 + bookRotateY * 3}%)`,
                  pointerEvents: 'none',
                  mixBlendMode: 'overlay',
                }}
              />
              {/* Spine ridge shadow */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: Math.max(8, 14 * scale),
                  background: 'linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: isWidescreen ? 360 * scale : 420 * scale,
                height: isWidescreen ? 540 * scale : 630 * scale,
                backgroundColor: '#1c1917',
                border: `2px solid ${palette.accent}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 30 * scale,
                color: '#fff',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 32 * scale, fontWeight: 700, fontFamily: palette.fontFamily }}>
                {title || 'Book Title'}
              </div>
              <div style={{ marginTop: 16 * scale, color: palette.accent, fontSize: 20 * scale }}>
                {author || 'Author'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Book details column */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isWidescreen ? 'flex-start' : 'center',
          textAlign: isWidescreen ? 'left' : 'center',
          maxWidth: isWidescreen ? '45%' : '85%',
          opacity: enterProgress,
          transform: `translateY(${interpolate(enterProgress, [0, 1], [20, 0])}px)`,
        }}
      >
        <PillBadge text="FEATURED RELEASE" accent={palette.accent} scale={scale} />

        <div
          style={{
            marginTop: Math.max(16, 28 * scale),
            color: palette.textPrimary,
            fontFamily: palette.fontFamily,
            fontSize: Math.max(26, Math.round(54 * scale)),
            fontWeight: 700,
            lineHeight: 1.15,
          }}
        >
          {title || 'Untitled Book'}
        </div>

        <div
          style={{
            marginTop: Math.max(10, 18 * scale),
            color: palette.accent,
            fontSize: Math.max(18, Math.round(34 * scale)),
            fontWeight: 600,
          }}
        >
          {author ? `By ${author}` : ''}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// Scene 4: Outro Call to Action
function Scene4({
  ctaText,
  title,
  palette,
  scale,
  durationInFrames,
}: {
  ctaText?: string | null
  title: string
  palette: Palette
  scale: number
  durationInFrames: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enterProgress = spring({ frame, fps, config: { damping: 14 } })
  const finalFade = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const platforms = ['AMAZON', 'BARNES & NOBLE', 'APPLE BOOKS', 'AUDIBLE']
  const ctaHeadline = ctaText || 'AVAILABLE NOW • GET YOUR COPY TODAY'

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Math.max(24, 70 * scale),
        textAlign: 'center',
        opacity: finalFade,
      }}
    >
      <div style={{ opacity: enterProgress }}>
        <PillBadge text="EXPERIENCE THE STORY" accent={palette.accent} scale={scale} />
      </div>

      <div
        style={{
          marginTop: Math.max(20, 45 * scale),
          color: palette.textPrimary,
          fontFamily: palette.fontFamily,
          fontSize: Math.max(32, Math.round(68 * scale)),
          fontWeight: 700,
          lineHeight: 1.2,
          maxWidth: '85%',
          opacity: enterProgress,
          transform: `scale(${interpolate(enterProgress, [0, 1], [0.92, 1])})`,
        }}
      >
        {ctaHeadline}
      </div>

      {/* Retailer badges staggered animation */}
      <div
        style={{
          marginTop: Math.max(24, 50 * scale),
          display: 'flex',
          flexWrap: 'wrap',
          gap: Math.max(8, 16 * scale),
          justifyContent: 'center',
          maxWidth: '90%',
        }}
      >
        {platforms.map((platform, i) => {
          const badgeProgress = spring({
            frame: Math.max(0, frame - 15 - i * 5),
            fps,
            config: { damping: 12 },
          })
          return (
            <div
              key={platform}
              style={{
                opacity: badgeProgress,
                transform: `scale(${badgeProgress})`,
              }}
            >
              <PillBadge text={platform} accent={palette.accent} scale={scale * 0.85} />
            </div>
          )
        })}
      </div>

      {title && (
        <div
          style={{
            marginTop: Math.max(24, 50 * scale),
            color: palette.textSecondary,
            fontSize: Math.max(14, Math.round(26 * scale)),
            fontStyle: 'italic',
            opacity: interpolate(frame, [30, 55], [0, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          "{title}"
        </div>
      )}
    </AbsoluteFill>
  )
}

function HyperframeLightingSweep({ scale }: { scale: number }) {
  const frame = useCurrentFrame()

  // Transition beats at scene changes (frames 0, 75, 150, 225)
  const beat = frame % 75
  const flareOpacity = interpolate(beat, [0, 4, 18], [0, 0.4, 0], {
    extrapolateRight: 'clamp',
  })
  const flareX = interpolate(beat, [0, 24], [-10, 110], {
    extrapolateRight: 'clamp',
  })

  if (flareOpacity <= 0.01) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `linear-gradient(115deg, transparent ${flareX - 30}%, rgba(255, 255, 255, ${flareOpacity}) ${flareX}%, rgba(254, 240, 138, ${flareOpacity * 0.6}) ${flareX + 10}%, transparent ${flareX + 35}%)`,
        mixBlendMode: 'screen',
        zIndex: 50,
      }}
    />
  )
}

export function BookTrailerComposition(props: BookTrailerCompositionProps) {
  const { durationInFrames, width, height } = useVideoConfig()
  const palette = PALETTES[props.style] ?? PALETTES.cinematic
  const scale = Math.min(width, height) / 1080
  const isWidescreen = width > height

  // 4 sequenced scenes with crossfade timing
  const sceneFrames = Math.floor(durationInFrames / 4)

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background layer with animations and styling */}
      <AnimatedBackground palette={palette} style={props.style} scale={scale} />

      {/* Hyperframes cinematic optical sweep */}
      <HyperframeLightingSweep scale={scale} />

      {/* Scene 1: The Hook */}
      <Sequence from={0} durationInFrames={sceneFrames}>
        <Scene1
          title={props.title}
          author={props.author}
          hookText={props.hookText}
          palette={palette}
          style={props.style}
          scale={scale}
          durationInFrames={sceneFrames}
        />
      </Sequence>

      {/* Scene 2: The Story */}
      <Sequence from={sceneFrames} durationInFrames={sceneFrames}>
        <Scene2
          blurb={props.blurb}
          author={props.author}
          palette={palette}
          scale={scale}
          durationInFrames={sceneFrames}
        />
      </Sequence>

      {/* Scene 3: Book Reveal */}
      <Sequence from={sceneFrames * 2} durationInFrames={sceneFrames}>
        <Scene3
          title={props.title}
          author={props.author}
          coverUrl={props.coverUrl}
          palette={palette}
          scale={scale}
          durationInFrames={sceneFrames}
          isWidescreen={isWidescreen}
        />
      </Sequence>

      {/* Scene 4: Call to Action */}
      <Sequence
        from={sceneFrames * 3}
        durationInFrames={durationInFrames - sceneFrames * 3}
      >
        <Scene4
          ctaText={props.ctaText}
          title={props.title}
          palette={palette}
          scale={scale}
          durationInFrames={durationInFrames - sceneFrames * 3}
        />
      </Sequence>
    </AbsoluteFill>
  )
}
