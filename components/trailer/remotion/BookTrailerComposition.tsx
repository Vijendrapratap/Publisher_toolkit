'use client'
import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion'
import type { TrailerStyle } from '@/lib/services/trailer/options'
import type { AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { adFontFamily } from './fonts'
import { fitFontSize } from './fit'

export interface BookTrailerCompositionProps {
  [key: string]: unknown
  spec: AdVideoSpec
  title: string
  author: string
  coverUrl?: string | null
  interiorImageUrls?: string[]
  musicSrc?: string | null
}

interface Palette {
  bgGradient: [string, string, string]
  accent: string
  textPrimary: string
  textSecondary: string
  fontFamily: string
}

function paletteFromSpec(spec: AdVideoSpec): Palette {
  const { bgFrom, bgTo, accent, text } = spec.style.colors
  return {
    bgGradient: [bgFrom, bgTo, bgTo],
    accent,
    textPrimary: text,
    textSecondary: `${text}cc`,
    fontFamily: adFontFamily(spec.style.font),
  }
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
  hook,
  palette,
  style,
  scale,
  durationInFrames,
}: {
  title: string
  author: string
  hook: string
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

  const mainHook = hook

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
          fontSize: fitFontSize(Math.max(32, Math.round(72 * scale)), mainHook, 28),
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
  storyLine,
  author,
  palette,
  scale,
  durationInFrames,
  isWidescreen,
  interiorImageUrl,
}: {
  storyLine: string
  author: string
  palette: Palette
  scale: number
  durationInFrames: number
  isWidescreen: boolean
  interiorImageUrl?: string | null
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

  const cleanBlurb = storyLine

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: isWidescreen && interiorImageUrl ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isWidescreen && interiorImageUrl ? Math.max(24, 60 * scale) : 0,
        padding: Math.max(30, 90 * scale),
        textAlign: isWidescreen && interiorImageUrl ? 'left' : 'center',
        opacity: exitOpacity,
      }}
    >
      {interiorImageUrl && (
        <div
          style={{
            maxWidth: isWidescreen ? '40%' : '55%',
            opacity: enterProgress,
            transform: `translateY(${interpolate(enterProgress, [0, 1], [30, 0])}px) rotateZ(-2deg)`,
            perspective: 800,
          }}
        >
          <div
            style={{
              overflow: 'hidden',
              borderRadius: Math.max(8, 16 * scale),
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0,0,0,0.3)',
              border: `1px solid ${palette.accent}30`,
            }}
          >
            <Img
              src={interiorImageUrl}
              alt=""
              style={{
                width: '100%',
                maxHeight: isWidescreen ? 480 * scale : 260 * scale,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isWidescreen && interiorImageUrl ? 'flex-start' : 'center',
          maxWidth: isWidescreen && interiorImageUrl ? '50%' : '82%',
        }}
      >
        <div style={{ opacity: enterProgress }}>
          <PillBadge text="THE STORY" accent={palette.accent} scale={scale} />
        </div>

        <div
          style={{
            marginTop: Math.max(12, 20 * scale),
            fontSize: Math.max(40, Math.round(90 * scale)),
            fontFamily: palette.fontFamily,
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
            marginTop: Math.max(8, 16 * scale),
            color: palette.textPrimary,
            fontFamily: palette.fontFamily,
            fontStyle: 'italic',
            fontSize: fitFontSize(Math.max(18, Math.round(40 * scale)), cleanBlurb, 90),
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
              marginTop: Math.max(16, 36 * scale),
              fontSize: Math.max(15, Math.round(28 * scale)),
              fontWeight: 600,
              color: palette.accent,
              opacity: interpolate(frame, [20, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}
          >
            — {author}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}

// Scene 3: Hero 3D Book Reveal
function Scene3({
  title,
  author,
  coverUrl,
  benefits,
  palette,
  scale,
  durationInFrames,
  isWidescreen,
  interiorImageUrl,
}: {
  title: string
  author: string
  coverUrl?: string | null
  benefits: string[]
  palette: Palette
  scale: number
  durationInFrames: number
  isWidescreen: boolean
  interiorImageUrl?: string | null
}) {
  const frame = useCurrentFrame()
  const { fps, height } = useVideoConfig()

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
  // Sized from the frame, not a fixed 630px: in a square frame a fixed cover
  // plus the title column ran past the bottom edge.
  const coverH = Math.round(height * (isWidescreen ? 0.6 : 0.4))
  const coverW = Math.round((coverH * 2) / 3)

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
      {/* 3D Book Cover Presentation with optional interior spread peek */}
      <div
        style={{
          perspective: 1000,
          opacity: enterProgress,
          transform: `scale(${bookScale})`,
          position: 'relative',
        }}
      >
        {interiorImageUrl && (
          <div
            style={{
              position: 'absolute',
              top: -12 * scale,
              left: isWidescreen ? -36 * scale : -24 * scale,
              zIndex: 0,
              transform: `rotateY(${bookRotateY - 8}deg) rotateZ(-6deg) scale(0.92)`,
              transformStyle: 'preserve-3d',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.75)',
              borderRadius: Math.max(6, 14 * scale),
              overflow: 'hidden',
              border: `1px solid ${palette.accent}40`,
              width: coverW,
              height: coverH,
            }}
          >
            <Img
              src={interiorImageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <div
          style={{
            position: 'relative',
            zIndex: 1,
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
              <Img
                src={coverUrl}
                alt=""
                style={{
                  width: coverW,
                  height: coverH,
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
                width: coverW,
                height: coverH,
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
            fontSize: fitFontSize(Math.max(26, Math.round(54 * scale)), title || 'Untitled Book', 24),
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

        {benefits.length > 0 && (
          <div
            style={{
              marginTop: Math.max(14, 26 * scale),
              display: 'flex',
              flexWrap: 'wrap',
              gap: Math.max(6, 12 * scale),
              justifyContent: isWidescreen ? 'flex-start' : 'center',
            }}
          >
            {benefits.map((benefit, i) => {
              const shown = spring({ frame: Math.max(0, frame - 12 - i * 6), fps, config: { damping: 14 } })
              return (
                <div key={i} style={{ opacity: shown, transform: `translateY(${interpolate(shown, [0, 1], [12, 0])}px)` }}>
                  <PillBadge text={benefit} accent={palette.accent} scale={scale * 0.9} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}

// Scene 4: Outro Call to Action
function Scene4({
  cta,
  title,
  palette,
  scale,
  durationInFrames,
}: {
  cta: string
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

  const ctaHeadline = cta

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

function LightSweep({ scale, sceneFrames }: { scale: number; sceneFrames: number }) {
  const frame = useCurrentFrame()

  // Transition beats at scene changes
  const beat = frame % sceneFrames
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

export function BookTrailerComposition({ spec, title, author, coverUrl, interiorImageUrls, musicSrc }: BookTrailerCompositionProps) {
  const { durationInFrames, width, height } = useVideoConfig()
  const palette = paletteFromSpec(spec)
  const scale = Math.min(width, height) / 1080
  // Square frames use the side-by-side layout too; stacked, they overflow.
  const isWidescreen = width >= height
  const sceneFrames = Math.floor(durationInFrames / 4)
  const lastFrames = durationInFrames - sceneFrames * 3

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {musicSrc && (
        <Audio
          src={musicSrc}
          loop
          volume={(f) =>
            interpolate(f, [0, 15, durationInFrames - 30, durationInFrames], [0, 0.8, 0.8, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
      <AnimatedBackground palette={palette} style={spec.style.preset as TrailerStyle} scale={scale} />
      <LightSweep scale={scale} sceneFrames={sceneFrames} />

      <Sequence from={0} durationInFrames={sceneFrames}>
        <Scene1 title={title} author={author} hook={spec.script.hook} palette={palette} style={spec.style.preset} scale={scale} durationInFrames={sceneFrames} />
      </Sequence>

      <Sequence from={sceneFrames} durationInFrames={sceneFrames}>
        <Scene2
          storyLine={spec.script.storyLine || title}
          author={author}
          palette={palette}
          scale={scale}
          durationInFrames={sceneFrames}
          isWidescreen={isWidescreen}
          interiorImageUrl={interiorImageUrls?.[0]}
        />
      </Sequence>

      <Sequence from={sceneFrames * 2} durationInFrames={sceneFrames}>
        <Scene3
          title={title}
          author={author}
          coverUrl={coverUrl}
          benefits={spec.script.benefits}
          palette={palette}
          scale={scale}
          durationInFrames={sceneFrames}
          isWidescreen={isWidescreen}
          interiorImageUrl={interiorImageUrls?.[1] || interiorImageUrls?.[0]}
        />
      </Sequence>

      <Sequence from={sceneFrames * 3} durationInFrames={lastFrames}>
        <Scene4 cta={spec.script.cta} title={title} palette={palette} scale={scale} durationInFrames={lastFrames} />
      </Sequence>
    </AbsoluteFill>
  )
}
