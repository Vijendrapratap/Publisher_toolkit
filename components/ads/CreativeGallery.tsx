'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, Expand, X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'

type GalleryImage = { id: string; sizeKey: string; width: number; height: number; imageUrl: string }

export function CreativeGallery({ images, platformLabel }: { images: GalleryImage[]; platformLabel: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [active, setActive] = useState<GalleryImage | null>(null)

  useEffect(() => {
    if (active) dialogRef.current?.showModal()
  }, [active])

  const alt = (img: GalleryImage) => `${platformLabel} ad, ${img.width}×${img.height}`

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((img) => (
          <li key={img.id} className="group flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
            <button
              type="button"
              onClick={() => setActive(img)}
              className="relative flex h-64 items-center justify-center bg-[repeating-conic-gradient(var(--color-surface-2)_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-4"
              aria-label={`Preview ${alt(img)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt={alt(img)}
                style={{ aspectRatio: `${img.width} / ${img.height}` }}
                className="max-h-full max-w-full rounded-md object-contain shadow-card"
              />
              <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-canvas/90 text-ink opacity-0 shadow-subtle transition-opacity group-hover:opacity-100">
                <Expand className="size-4" aria-hidden />
              </span>
            </button>
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">{img.width}×{img.height}</span>
                <span className="font-mono text-[11px] text-ink-muted">{img.sizeKey}</span>
              </span>
              <a href={img.imageUrl} download={`${img.sizeKey}.png`} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                <Download className="size-4" aria-hidden /> Download
              </a>
            </div>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setActive(null)}
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="m-auto max-h-[90dvh] max-w-[90vw] rounded-card bg-surface p-0 text-ink shadow-lift ring-1 ring-line backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        {active && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
              <span className="text-sm font-medium">{alt(active)}</span>
              <div className="flex items-center gap-2">
                <a href={active.imageUrl} download={`${active.sizeKey}.png`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                  <Download className="size-4" aria-hidden /> Download
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
              <img src={active.imageUrl} alt={alt(active)} className="max-h-[75dvh] max-w-full rounded-md object-contain" />
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
