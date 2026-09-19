'use client'

import { useId, useState, useEffect, type DragEvent, type ChangeEvent } from 'react'
import { ImageIcon, Plus, Trash2, UploadCloud } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { formatBytes, COVER_RULE } from '@/lib/services/ads/validation'

export interface InteriorImagesDropzoneProps {
  id?: string
  label?: string
  description?: string
  files: File[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
}

export function InteriorImagesDropzone({
  id: customId,
  label = 'Internal Page Images & Illustrations',
  description = 'Upload up to 5 internal pages, maps, chapter openers, or excerpt spreads. Select multiple at once or click + to add pages one by one.',
  files,
  onFilesChange,
  maxFiles = 5,
}: InteriorImagesDropzoneProps) {
  const generatedId = useId()
  const inputId = customId || generatedId
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviewUrls(urls)

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  function handleFiles(incoming: FileList | File[] | null) {
    if (!incoming) return
    setError(null)

    const validNewFiles: File[] = []
    const rawList = Array.from(incoming)

    for (const file of rawList) {
      if (!COVER_RULE.accept.includes(file.type)) {
        setError('Only PNG, JPG, and WebP images are supported.')
        continue
      }
      if (file.size > COVER_RULE.maxBytes) {
        setError(`"${file.name}" exceeds the 10MB limit.`)
        continue
      }
      // Avoid duplicate uploads by file name and size
      const isDuplicate = files.some((existing) => existing.name === file.name && existing.size === file.size)
      if (!isDuplicate) {
        validNewFiles.push(file)
      }
    }

    if (validNewFiles.length === 0) return

    const slotsAvailable = maxFiles - files.length
    if (slotsAvailable <= 0) {
      setError(`Maximum of ${maxFiles} internal pages reached.`)
      return
    }

    const filesToAdd = validNewFiles.slice(0, slotsAvailable)
    if (validNewFiles.length > slotsAvailable) {
      setError(`Only ${slotsAvailable} more internal page ${slotsAvailable === 1 ? 'image' : 'images'} could be added (max ${maxFiles}).`)
    }

    onFilesChange([...files, ...filesToAdd])
  }

  function removeFile(index: number) {
    const updated = files.filter((_, i) => i !== index)
    onFilesChange(updated)
    setError(null)
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
    // Clear value to allow selecting the same file again if removed
    e.target.value = ''
  }

  const reachedMax = files.length >= maxFiles

  return (
    <div className="flex flex-col gap-2.5">
      {/* Hidden file input supporting multiple selection */}
      <input
        id={inputId}
        type="file"
        multiple
        accept={COVER_RULE.accept.join(',')}
        className="peer sr-only"
        onChange={onInputChange}
      />

      {/* Header with Label and Counter */}
      <div className="flex items-center justify-between">
        <div>
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {label}
          </label>
          {description && <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!reachedMax && files.length > 0 && (
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent hover:text-on-accent"
            >
              <Plus className="size-3.5" aria-hidden />
              Add More
            </label>
          )}
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
              files.length >= 2
                ? 'bg-accent-soft text-accent'
                : files.length > 0
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-surface-2 text-ink-muted'
            )}
          >
            {files.length} / {maxFiles} images
          </span>
        </div>
      </div>

      {/* Uploaded Gallery Grid + Inline "+" Tile */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${file.size}-${idx}`}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-subtle transition hover:border-accent/40"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-2">
                {previewUrls[idx] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrls[idx]}
                    alt={`Internal page ${idx + 1}`}
                    className="size-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-ink-muted">
                    <ImageIcon className="size-6" aria-hidden />
                  </div>
                )}
                {/* Remove Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    aria-label={`Remove image ${file.name}`}
                    className="rounded-full bg-danger p-2 text-white shadow-lg transition hover:bg-danger/90 hover:scale-110"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="p-1.5 text-center">
                <p className="truncate text-[11px] font-medium text-ink">{file.name}</p>
                <p className="text-[10px] text-ink-muted">{formatBytes(file.size)}</p>
              </div>
            </div>
          ))}

          {/* Plus (+) option tile to keep adding images up to 5 */}
          {!reachedMax && (
            <label
              htmlFor={inputId}
              className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/20 p-3 text-center transition hover:border-accent hover:bg-accent-soft/40 hover:scale-[1.02]"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent shadow-sm">
                <Plus className="size-5" aria-hidden />
              </span>
              <span className="text-xs font-semibold text-ink">Add Page</span>
              <span className="text-[10px] text-ink-muted">({maxFiles - files.length} remaining)</span>
            </label>
          )}
        </div>
      )}

      {/* Main Empty Dropzone with prominent "+" option when no files uploaded yet */}
      {files.length === 0 && (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-line bg-surface-2/60 p-6 text-center transition-colors hover:border-accent hover:bg-accent-soft/25',
            dragging && 'border-accent bg-accent-soft/50',
            error && 'border-danger/60'
          )}
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-accent text-on-accent shadow-subtle transition-transform hover:scale-105">
            <Plus className="size-6" aria-hidden />
          </span>
          <div className="text-xs">
            <span className="font-semibold text-accent">Click + to add internal pages</span>
            <span className="text-ink-muted"> or drag images here</span>
          </div>
          <p className="text-[11px] text-ink-muted leading-tight">
            Upload multiple images at once or keep adding one by one (up to {maxFiles} images) • PNG, JPG, WebP
          </p>
        </label>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
