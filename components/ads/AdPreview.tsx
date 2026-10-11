'use client'
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { BookImage, Play } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { CreativeTemplate } from '@/lib/services/ads/CreativeTemplate'
import type { TemplatePalette } from '@/lib/services/ads/options'
import { nextRadioIndex } from '@/lib/ui/radioKeys'

const MAX_PREVIEW_HEIGHT = 340

/** Width of the element, kept current as the layout changes. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** The real ad template, drawn at full size and scaled down to fit — what you see is what generates. */
export function AdImagePreview({
  sizes,
  palette,
  coverUrl,
  title,
  author,
  badge,
  ctaText,
}: {
  sizes: { key: string; width: number; height: number }[]
  palette: TemplatePalette
  coverUrl: string | null
  title: string
  author: string
  badge: string
  ctaText: string
}) {
  const [ref, available] = useWidth()
  const [sizeKey, setSizeKey] = useState(sizes[0]?.key)
  const size = sizes.find((s) => s.key === sizeKey) ?? sizes[0]
  if (!size) return null
  const scale = available ? Math.min(available / size.width, MAX_PREVIEW_HEIGHT / size.height) : 0

  return (
    <div className="flex flex-col gap-3">
      <div ref={ref} className="grid place-items-center rounded-xl bg-surface-2 p-3 shadow-inset" style={{ minHeight: 120 }}>
        {scale > 0 && (
          <div className="overflow-hidden rounded-md shadow-card" style={{ width: size.width * scale, height: size.height * scale }}>
            <div
              data-testid="ad-preview"
              style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            >
              {coverUrl ? (
                <CreativeTemplate
                  coverImageUrl={coverUrl}
                  title={title}
                  author={author}
                  width={size.width}
                  height={size.height}
                  palette={palette}
                  campaignBadge={badge}
                  ctaText={ctaText}
                />
              ) : (
                <div className="grid size-full place-items-center" style={{ background: palette.background }}>
                  <BookImage className="size-10" style={{ color: palette.ink }} aria-hidden />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {sizes.length > 1 && (
        <div role="radiogroup" aria-label="Preview size" className="flex flex-wrap gap-1.5">
          {sizes.map((s, i) => {
            const selected = s.key === size.key
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setSizeKey(s.key)}
                onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                  const next = nextRadioIndex(e.key, i, sizes.length)
                  if (next === null) return
                  e.preventDefault()
                  setSizeKey(sizes[next].key)
                }}
                className={cn(
                  'rounded-full px-3 py-1 font-mono text-xs transition-colors',
                  selected ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-muted hover:text-ink'
                )}
              >
                {s.width}×{s.height}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** A still of the video's opening frame in the chosen shape and style. */
export function VideoFramePreview({
  width,
  height,
  palette,
  coverUrl,
  title,
  badge,
  caption,
}: {
  width: number
  height: number
  palette: { background: string; accent: string; ink: string }
  coverUrl: string | null
  title: string
  badge: string
  caption: string
}) {
  const portrait = height > width
  return (
    <div className="flex flex-col gap-3">
      <div className="grid place-items-center rounded-xl bg-surface-2 p-3 shadow-inset">
        <div
          data-testid="video-preview"
          className={cn('relative flex items-center justify-center gap-4 overflow-hidden rounded-md p-5 shadow-card transition-all', portrait && 'flex-col')}
          style={{
            aspectRatio: `${width} / ${height}`,
            width: portrait ? 'auto' : '100%',
            height: portrait ? 300 : 'auto',
            background: `radial-gradient(circle at 30% 30%, ${palette.accent}33, ${palette.background} 70%)`,
            color: palette.ink,
          }}
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className={cn('rounded shadow-lg', portrait ? 'w-1/2' : 'h-3/4')} />
          ) : (
            <BookImage className="size-10" aria-hidden />
          )}
          <div className={cn('flex min-w-0 flex-col gap-1.5', portrait ? 'items-center text-center' : 'items-start')}>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider" style={{ borderColor: palette.accent, color: palette.accent }}>
              {badge}
            </span>
            <span className="line-clamp-2 font-display text-lg font-semibold leading-tight">{title}</span>
          </div>
          <span className="absolute bottom-2 left-2 grid size-7 place-items-center rounded-full bg-black/50 text-white">
            <Play className="size-3.5 fill-current" aria-hidden />
          </span>
        </div>
      </div>
      <p className="text-center text-sm text-ink-muted">{caption}</p>
    </div>
  )
}
