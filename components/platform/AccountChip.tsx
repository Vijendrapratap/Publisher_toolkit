'use client'

import { useState, useEffect, useRef, useId } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { toast } from 'sonner'
import {
  ChevronDown,
  Sparkles,
  Megaphone,
  BookOpen,
  Sun,
  Moon,
  Sliders,
  Edit3,
  CheckCircle2,
  Layers,
  ArrowRight,
} from 'lucide-react'
import type { CapabilityStatus } from '@/lib/providers/status'
import { cn } from '@/components/ui/cn'

export const DEFAULT_PUBLISHER_ID = 'dev-local-publisher'

export interface AccountChipProps {
  publisherId?: string
  status?: CapabilityStatus
  isClerk?: boolean
}

const TONES = [
  { key: 'punchy', label: 'Punchy', hint: 'Short, high-energy hooks' },
  { key: 'literary', label: 'Literary', hint: 'Rich, atmospheric prose' },
  { key: 'bold', label: 'Bold', hint: 'Direct, provocative claims' },
  { key: 'urgent', label: 'Urgent', hint: 'Fast-paced call to action' },
  { key: 'playful', label: 'Playful', hint: 'Lighthearted, witty voice' },
] as const

export function AccountChip({
  publisherId = DEFAULT_PUBLISHER_ID,
  status,
  isClerk = false,
}: AccountChipProps) {
  const [open, setOpen] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [studioName, setStudioName] = useState('Local Publisher Studio')
  const [tempName, setTempName] = useState('Local Publisher Studio')
  const [defaultTone, setDefaultTone] = useState<string>('punchy')
  const [dark, setDark] = useState(false)

  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupId = useId()

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('pt_studio_name')
      if (savedName) {
        setStudioName(savedName)
        setTempName(savedName)
      }
      const savedTone = localStorage.getItem('pt_default_tone')
      if (savedTone) setDefaultTone(savedTone)

      setDark(document.documentElement.classList.contains('dark'))
    } catch {}
  }, [])

  // Close popover on click outside or Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
        setIsEditingName(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setIsEditingName(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (isClerk) {
    return <UserButton />
  }

  const handleSaveName = () => {
    const trimmed = tempName.trim() || 'Local Publisher Studio'
    setStudioName(trimmed)
    setTempName(trimmed)
    setIsEditingName(false)
    try {
      localStorage.setItem('pt_studio_name', trimmed)
      toast.success('Publisher imprint name updated')
    } catch {}
  }

  const handleToneSelect = (toneKey: string) => {
    setDefaultTone(toneKey)
    try {
      localStorage.setItem('pt_default_tone', toneKey)
      toast.success(`Default ad copy tone set to "${toneKey}"`)
    } catch {}
  }

  const handleToggleTheme = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
    setDark(next)
  }

  // Derive monogram from studio name
  const initials =
    studioName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'LP'

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={popupId}
        aria-haspopup="dialog"
        aria-label={`Publisher profile for ${studioName}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'group inline-flex h-9 items-center gap-2 rounded-full bg-surface px-2.5 text-sm font-medium shadow-subtle transition-all hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]',
          open && 'bg-surface-2 ring-1 ring-accent/30'
        )}
      >
        <span className="relative grid size-7 place-items-center rounded-full bg-accent text-xs font-semibold text-on-accent shadow-subtle">
          {initials}
          <span
            className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-success"
            title="Local Session Active"
          />
        </span>
        <span className="hidden max-w-[130px] truncate text-xs font-medium text-ink sm:inline md:max-w-[160px]">
          {studioName}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 text-ink-muted transition-transform duration-200 group-hover:text-ink',
            open && 'rotate-180 text-ink'
          )}
          aria-hidden
        />
      </button>

      {/* Profile Popover / Modal Menu */}
      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-modal="false"
          aria-label="Publisher Profile"
          className="absolute right-0 top-11 z-50 w-80 max-h-[85vh] overflow-y-auto rounded-2xl bg-surface p-4 text-ink shadow-lift ring-1 ring-line"
        >
          {/* Header: Imprint Identity */}
          <div className="flex items-start gap-3 rounded-xl bg-surface-2/70 p-3 shadow-inset">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-sm font-bold text-on-accent shadow-subtle">
              {initials}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className="h-7 w-full rounded-md border border-line bg-surface px-2 text-xs font-medium text-ink focus:border-accent focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-on-accent shadow-subtle hover:bg-accent-strong"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-display text-sm font-semibold tracking-tight text-ink">
                    {studioName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="rounded p-0.5 text-ink-muted hover:bg-surface hover:text-ink"
                    title="Edit imprint name"
                  >
                    <Edit3 className="size-3" />
                    <span className="sr-only">Edit imprint name</span>
                  </button>
                </div>
              )}
              <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  Active Imprint
                </span>
                <span>•</span>
                <span>Publisher</span>
              </div>
            </div>
          </div>

          {/* Quick Studio Navigation */}
          <div className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Publishing Tools
            </span>
            <div className="flex flex-col gap-1">
              <Link
                href="/create-book"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl bg-surface-2/40 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:text-accent"
              >
                <Sparkles className="size-4 text-accent" />
                <span>Create Your Book</span>
              </Link>
              <Link
                href="/ads/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl bg-surface-2/40 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:text-accent"
              >
                <Megaphone className="size-4 text-accent" />
                <span>Amazon Ads & A+ Content</span>
              </Link>
              <Link
                href="/ads"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl bg-surface-2/40 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:text-accent"
              >
                <Layers className="size-4 text-accent" />
                <span>My Book Library</span>
              </Link>
            </div>
          </div>

          {/* Preferred Copy Tone */}
          <div className="mt-3.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Default Ad Voice & Tone
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleToneSelect(t.key)}
                  className={cn(
                    'flex flex-col items-start rounded-xl p-2 text-left transition-all',
                    defaultTone === t.key
                      ? 'bg-accent-soft/70 ring-1 ring-accent text-ink shadow-subtle'
                      : 'bg-surface-2/40 text-ink-muted hover:bg-surface-2 hover:text-ink'
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-semibold">{t.label}</span>
                    {defaultTone === t.key && <CheckCircle2 className="size-3 text-accent" />}
                  </div>
                  <span className="mt-0.5 text-[10px] leading-tight opacity-75">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme Mode Toggle */}
          <div className="mt-3.5 flex items-center justify-between rounded-xl bg-surface-2/40 p-2.5 text-xs">
            <span className="flex items-center gap-2 font-medium text-ink">
              {dark ? <Moon className="size-3.5 text-accent" /> : <Sun className="size-3.5 text-accent" />}
              Appearance
            </span>
            <button
              type="button"
              onClick={handleToggleTheme}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium shadow-subtle hover:bg-surface-2"
            >
              <span>{dark ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
          </div>

          {/* Studio Profile & Settings Link */}
          <div className="mt-3 pt-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl bg-accent/10 p-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
            >
              <span className="flex items-center gap-2">
                <Sliders className="size-4" />
                <span>Imprint Profile & Settings</span>
              </span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Footer Strip */}
          <div className="mt-3 flex items-center justify-end border-t border-line/60 pt-2 text-[11px] text-ink-muted">
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                toast.success('Signed out')
                window.location.href = '/sign-in'
              }}
              className="text-danger hover:underline font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
