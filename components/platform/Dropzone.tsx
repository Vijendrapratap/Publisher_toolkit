'use client'
import { useId, useState, type DragEvent } from 'react'
import { FileText, ImageIcon, UploadCloud, X } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { formatBytes, validateFile, type FileRule } from '@/lib/services/ads/validation'

export function Dropzone({
  id,
  label,
  rule,
  file,
  onFileChange,
  hint,
  compact = false,
}: {
  id: string
  label: string
  rule: FileRule
  file: File | null
  onFileChange: (file: File | null) => void
  hint?: string
  compact?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  const isImage = rule.accept.every((t) => t.startsWith('image/'))

  function accept(candidate: File | undefined) {
    if (!candidate) return
    const problem = validateFile(candidate, rule)
    setError(problem)
    onFileChange(problem ? null : candidate)
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    accept(e.dataTransfer.files[0])
  }

  if (file) {
    const Icon = isImage ? ImageIcon : FileText
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent shadow-subtle">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-ink-muted">{formatBytes(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            aria-label={`Remove ${file.name}`}
            className="ml-auto grid size-8 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        id={id}
        type="file"
        accept={rule.accept.join(',')}
        className="peer sr-only"
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-transparent bg-surface-2 text-center shadow-inset transition-colors hover:border-accent/50 hover:bg-accent-soft/50',
          'peer-focus-visible:border-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent/20',
          compact ? 'px-4 py-6' : 'px-6 py-12',
          dragging && 'border-accent bg-accent-soft/60',
          error && 'border-danger/60'
        )}
      >
        <span className={cn('grid place-items-center rounded-2xl bg-accent-soft text-accent shadow-subtle', compact ? 'size-10' : 'size-14')}>
          <UploadCloud className={compact ? 'size-5' : 'size-7'} aria-hidden />
        </span>
        <span className={cn('font-medium', compact ? 'text-sm' : 'text-base')}>
          <span className="text-accent">Choose a file</span> or drag it here
        </span>
        <span className="text-xs text-ink-muted">{hint ?? `Use ${rule.label}`}</span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
