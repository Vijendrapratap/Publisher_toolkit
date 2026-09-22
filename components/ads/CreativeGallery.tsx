'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Expand, Layers, ShoppingBag, X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'

export type GalleryImage = {
  id: string
  sizeKey: string
  width: number
  height: number
  imageUrl: string
}

export interface CreativeGalleryProps {
  images: GalleryImage[]
  platformLabel: string
}

function getFormatMetadata(sizeKey: string, width: number, height: number) {
  if (sizeKey.includes('aplus_banner') || (width === 970 && height === 600)) {
    return {
      category: 'aplus' as const,
      label: 'A+ Standard Header Banner',
      badge: 'Amazon A+ 970×600',
      description: 'Brand hero header for KDP Enhanced Content',
    }
  }
  if (sizeKey.includes('aplus_feature') || (width === 970 && height === 300)) {
    return {
      category: 'aplus' as const,
      label: 'A+ Feature / Spec Banner',
      badge: 'Amazon A+ 970×300',
      description: 'Highlight key themes, worldbuilding & reviews',
    }
  }
  if (sizeKey.includes('aplus_square') || (width === 300 && height === 300)) {
    return {
      category: 'aplus' as const,
      label: 'A+ Quad Module / Highlight',
      badge: 'Amazon A+ 300×300',
      description: 'Character portraits and highlight features',
    }
  }
  if (sizeKey.includes('300x250') || (width === 300 && height === 250)) {
    return {
      category: 'sponsored' as const,
      label: 'Sponsored Display Ad',
      badge: 'Amazon Ads 300×250',
      description: 'Product detail pages and Kindle lockscreens',
    }
  }
  if (sizeKey.includes('1200x628') || (width === 1200 && height === 628)) {
    return {
      category: 'sponsored' as const,
      label: 'Sponsored Brands Banner',
      badge: 'Amazon Ads 1200×628',
      description: 'Prime top-of-search results banner placement',
    }
  }
  return {
    category: 'sponsored' as const,
    label: `${width}×${height} Banner`,
    badge: `${width}×${height}`,
    description: 'Ad creative',
  }
}

export function CreativeGallery({
  images,
  platformLabel,
}: CreativeGalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [active, setActive] = useState<GalleryImage | null>(null)
  const [filter, setFilter] = useState<'all' | 'aplus' | 'sponsored'>('all')

  useEffect(() => {
    if (active) dialogRef.current?.showModal()
  }, [active])

  const alt = (img: GalleryImage) => `${platformLabel} ad, ${img.width}×${img.height}`
  const getAssetUrl = (img: GalleryImage) => (img.id ? `/api/creatives/${img.id}/image` : img.imageUrl)
  const getDownloadUrl = (img: GalleryImage) =>
    img.id ? `/api/creatives/${img.id}/image?download=1` : img.imageUrl

  const aplusImages = images.filter((img) => getFormatMetadata(img.sizeKey, img.width, img.height).category === 'aplus')
  const sponsoredImages = images.filter((img) => getFormatMetadata(img.sizeKey, img.width, img.height).category === 'sponsored')

  const displayedImages = filter === 'aplus' ? aplusImages : filter === 'sponsored' ? sponsoredImages : images

  return (
    <div className="flex flex-col gap-6">
      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line/60 pb-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors',
            filter === 'all'
              ? 'bg-accent text-on-accent shadow-subtle'
              : 'bg-surface text-ink hover:bg-surface-2'
          )}
        >
          All Assets ({images.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter('aplus')}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors',
            filter === 'aplus'
              ? 'bg-accent text-on-accent shadow-subtle'
              : 'bg-surface text-ink hover:bg-surface-2'
          )}
        >
          <Layers className="size-3.5" />
          <span>Amazon A+ Content ({aplusImages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('sponsored')}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors',
            filter === 'sponsored'
              ? 'bg-accent text-on-accent shadow-subtle'
              : 'bg-surface text-ink hover:bg-surface-2'
          )}
        >
          <ShoppingBag className="size-3.5" />
          <span>Sponsored Ads ({sponsoredImages.length})</span>
        </button>
      </div>

      {/* Image Creatives Grid */}
      {displayedImages.length > 0 && (
        <ul className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
          {displayedImages.map((img) => {
            const meta = getFormatMetadata(img.sizeKey, img.width, img.height)
            const isWide = img.width / img.height >= 2.0

            return (
              <li
                key={img.id}
                className={cn(
                  'group flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card transition-all hover:shadow-lift',
                  isWide ? 'col-span-full' : ''
                )}
              >
                <button
                  type="button"
                  onClick={() => setActive(img)}
                  className={cn(
                    'relative flex items-center justify-center bg-[repeating-conic-gradient(var(--color-surface-2)_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-4',
                    isWide ? 'h-72' : 'h-64'
                  )}
                  aria-label={`Preview ${alt(img)}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getAssetUrl(img)}
                    alt={alt(img)}
                    style={{ aspectRatio: `${img.width} / ${img.height}` }}
                    className="max-h-full max-w-full rounded-md object-contain shadow-card transition-transform group-hover:scale-[1.01]"
                  />
                  <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-canvas/90 text-ink opacity-0 shadow-subtle transition-opacity group-hover:opacity-100">
                    <Expand className="size-4" aria-hidden />
                  </span>
                  <span className="absolute left-3 top-3 rounded-md bg-canvas/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink shadow-subtle">
                    {meta.badge}
                  </span>
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 bg-surface">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-ink">{meta.label}</span>
                    <span className="truncate text-xs text-ink-muted">{meta.description}</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                      {img.width}×{img.height}
                    </span>
                    <a
                      href={getDownloadUrl(img)}
                      download={`${img.sizeKey}.png`}
                      className={buttonClasses({
                        variant: 'ghost',
                        size: 'sm',
                        className: 'shrink-0',
                      })}
                    >
                      <Download className="size-3.5" aria-hidden /> Download
                    </a>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Fullscreen Zoom Dialog */}
      <dialog
        ref={dialogRef}
        onClose={() => setActive(null)}
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="m-auto max-h-[90dvh] max-w-[90vw] rounded-card bg-surface p-0 text-ink shadow-lift ring-1 ring-line backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        {active && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
              <span className="text-sm font-semibold">{alt(active)}</span>
              <div className="flex items-center gap-2">
                <a
                  href={getDownloadUrl(active)}
                  download={`${active.sizeKey}.png`}
                  className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                >
                  <Download className="size-4" aria-hidden /> Download PNG
                </a>
                <button
                  type="button"
                  onClick={() => dialogRef.current?.close()}
                  aria-label="Close preview"
                  className="grid size-8 place-items-center rounded-full hover:bg-surface-2"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="grid place-items-center bg-surface-2 p-6 shadow-inset">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAssetUrl(active)}
                alt={alt(active)}
                className="max-h-[75dvh] max-w-full rounded-md object-contain"
              />
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
