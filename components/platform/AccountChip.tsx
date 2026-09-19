'use client'

import { useState, useEffect, useRef, useId } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { toast } from 'sonner'
import {
  ChevronDown,
  Copy,
  Check,
  Sparkles,
  Database,
  HardDrive,
  ShieldCheck,
  PlusCircle,
  BookOpen,
  Sun,
  Moon,
  Sliders,
  Edit3,
  RotateCcw,
  LayoutGrid,
  CheckCircle2,
  Users,
  Layers,
  Info,
  Cpu,
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

type TabType = 'overview' | 'preferences' | 'diagnostics'

const TONES = [
  { key: 'punchy', label: 'Punchy', hint: 'Short, high-energy hooks' },
  { key: 'literary', label: 'Literary', hint: 'Rich, atmospheric prose' },
  { key: 'bold', label: 'Bold', hint: 'Direct, provocative claims' },
  { key: 'urgent', label: 'Urgent', hint: 'Fast-paced call to action' },
  { key: 'playful', label: 'Playful', hint: 'Lighthearted, witty voice' },
] as const

const PERSONAS = [
  { id: 'dev-local-publisher', name: 'Local Publisher Studio (Default)', role: 'Primary Studio Tenant' },
  { id: 'dev-second-publisher', name: 'Second Publisher (Isolation Test)', role: 'Secondary Test Tenant' },
  { id: 'indie-press-preview', name: 'Indie Press Co. (Demo)', role: 'Demo Tenant' },
] as const

export function AccountChip({
  publisherId = DEFAULT_PUBLISHER_ID,
  status,
  isClerk = false,
}: AccountChipProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabType>('overview')
  const [copied, setCopied] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [studioName, setStudioName] = useState('Local Publisher Studio')
  const [tempName, setTempName] = useState('Local Publisher Studio')
  const [defaultTone, setDefaultTone] = useState<string>('punchy')
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(['META', 'GOOGLE', 'AMAZON'])
  const [activePersona, setActivePersona] = useState(publisherId)
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

      const savedPlatforms = localStorage.getItem('pt_default_platforms')
      if (savedPlatforms) setTargetPlatforms(JSON.parse(savedPlatforms))

      const savedPersona = localStorage.getItem('pt_tenant_persona')
      if (savedPersona) setActivePersona(savedPersona)

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

  const handleCopyId = (idToCopy: string = activePersona) => {
    try {
      navigator.clipboard.writeText(idToCopy)
      setCopied(true)
      toast.success('Publisher Tenant ID copied to clipboard', {
        description: idToCopy,
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const handleSaveName = () => {
    const trimmed = tempName.trim() || 'Local Publisher Studio'
    setStudioName(trimmed)
    setTempName(trimmed)
    setIsEditingName(false)
    try {
      localStorage.setItem('pt_studio_name', trimmed)
      toast.success('Publisher studio name updated')
    } catch {}
  }

  const handleToneSelect = (toneKey: string) => {
    setDefaultTone(toneKey)
    try {
      localStorage.setItem('pt_default_tone', toneKey)
      toast.success(`Default ad copy tone set to "${toneKey}"`)
    } catch {}
  }

  const handleTogglePlatform = (platform: string) => {
    let next: string[]
    if (targetPlatforms.includes(platform)) {
      if (targetPlatforms.length === 1) {
        toast.error('At least one platform must remain selected')
        return
      }
      next = targetPlatforms.filter((p) => p !== platform)
    } else {
      next = [...targetPlatforms, platform]
    }
    setTargetPlatforms(next)
    try {
      localStorage.setItem('pt_default_platforms', JSON.stringify(next))
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

  const handleSwitchPersona = (newPersona: string) => {
    setActivePersona(newPersona)
    try {
      localStorage.setItem('pt_tenant_persona', newPersona)
      toast.info(`Simulated tenant set to ${newPersona}`, {
        description: 'Multi-tenant queries test data isolation for this persona.',
      })
    } catch {}
  }

  const handleResetPreferences = () => {
    try {
      localStorage.removeItem('pt_studio_name')
      localStorage.removeItem('pt_default_tone')
      localStorage.removeItem('pt_default_platforms')
      localStorage.removeItem('pt_tenant_persona')
      setStudioName('Local Publisher Studio')
      setTempName('Local Publisher Studio')
      setDefaultTone('punchy')
      setTargetPlatforms(['META', 'GOOGLE', 'AMAZON'])
      setActivePersona(publisherId)
      toast.success('Studio preferences reset to default')
    } catch {}
  }

  // Derive monogram from studio name
  const initials = studioName
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
          aria-label="Publisher Profile and Workspace Options"
          className="absolute right-0 top-11 z-50 w-84 max-h-[85vh] overflow-y-auto rounded-2xl bg-surface p-4 text-ink shadow-lift ring-1 ring-line sm:w-92"
        >
          {/* Header Card: Studio Identity */}
          <div className="flex flex-col gap-3 rounded-xl bg-surface-2/70 p-3 shadow-inset">
            <div className="flex items-start gap-3">
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
                      title="Edit studio name"
                    >
                      <Edit3 className="size-3" />
                      <span className="sr-only">Edit studio name</span>
                    </button>
                  </div>
                )}
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1 font-medium text-success">
                    <span className="size-1.5 rounded-full bg-success animate-pulse" />
                    Local Studio
                  </span>
                  <span>•</span>
                  <span>Solo Publisher</span>
                </div>
              </div>
            </div>

            {/* Tenant ID Row */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs">
              <span className="text-ink-muted">Tenant ID:</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <code className="truncate text-ink-muted" title={activePersona}>
                  {activePersona}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyId(activePersona)}
                  className="inline-flex size-6 items-center justify-center rounded text-ink-muted hover:bg-surface-2 hover:text-ink"
                  title="Copy Tenant ID to clipboard"
                >
                  {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                  <span className="sr-only">Copy Tenant ID</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabbed Navigation inside Profile */}
          <div className="mt-3 flex rounded-lg bg-surface-2/60 p-1 text-xs font-medium text-ink-muted shadow-inset">
            <button
              type="button"
              onClick={() => setTab('overview')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors',
                tab === 'overview' ? 'bg-surface font-semibold text-ink shadow-subtle' : 'hover:text-ink'
              )}
            >
              <LayoutGrid className="size-3.5" />
              Overview
            </button>
            <button
              type="button"
              onClick={() => setTab('preferences')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors',
                tab === 'preferences' ? 'bg-surface font-semibold text-ink shadow-subtle' : 'hover:text-ink'
              )}
            >
              <Sliders className="size-3.5" />
              Preferences
            </button>
            <button
              type="button"
              onClick={() => setTab('diagnostics')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors',
                tab === 'diagnostics' ? 'bg-surface font-semibold text-ink shadow-subtle' : 'hover:text-ink'
              )}
            >
              <Database className="size-3.5" />
              Environment
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {tab === 'overview' && (
            <div className="mt-3 flex flex-col gap-3">
              {/* Quick Actions */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Quick Actions
                </span>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <Link
                    href="/ads/new"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl bg-surface-2/50 p-2.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:text-accent"
                  >
                    <PlusCircle className="size-4 text-accent" />
                    <span>New Campaign</span>
                  </Link>
                  <Link
                    href="/ads"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl bg-surface-2/50 p-2.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:text-accent"
                  >
                    <BookOpen className="size-4 text-accent" />
                    <span>My Books</span>
                  </Link>
                </div>
              </div>

              {/* Workspace Snapshot */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Workspace Capabilities
                </span>
                <div className="flex flex-col divide-y divide-line/60 rounded-xl bg-surface-2/40 px-3 py-1 text-xs shadow-inset">
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <Database className="size-3.5 text-accent" /> Database
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-success">
                      <span className="size-1.5 rounded-full bg-success" />
                      PostgreSQL Local
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <HardDrive className="size-3.5 text-accent" /> File Store
                    </span>
                    <span className="font-medium text-ink">
                      {status?.storage === 'real' ? 'Vercel Blob' : '.local-storage/'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <Sparkles className="size-3.5 text-accent" /> AI Copy Engine
                    </span>
                    <span className="font-medium text-ink">
                      {status?.ai === 'real' ? 'OpenRouter (Claude)' : 'Deterministic Sample'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <ShieldCheck className="size-3.5 text-accent" /> Auth Service
                    </span>
                    <span className="font-medium text-ink">Local Dev Publisher</span>
                  </div>
                </div>
              </div>

              {/* Theme Selector Shortcut */}
              <div className="flex items-center justify-between rounded-xl bg-surface-2/40 p-2.5 text-xs">
                <span className="flex items-center gap-2 font-medium text-ink">
                  {dark ? <Moon className="size-3.5 text-accent" /> : <Sun className="size-3.5 text-accent" />}
                  Theme Mode
                </span>
                <button
                  type="button"
                  onClick={handleToggleTheme}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium shadow-subtle hover:bg-surface-2"
                >
                  <span>{dark ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
              </div>

              {/* Studio Settings & MCP Connectors Shortcut */}
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl bg-accent/10 p-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
              >
                <span className="flex items-center gap-2">
                  <Cpu className="size-4" />
                  <span>Meta & Google MCP Connectors</span>
                </span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}

          {/* TAB 2: PREFERENCES */}
          {tab === 'preferences' && (
            <div className="mt-3 flex flex-col gap-3.5">
              {/* Default Tone Selection */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    Preferred Ad Copy Tone
                  </span>
                  <span className="text-[10px] text-ink-muted">Pre-selected on upload</span>
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
                          : 'bg-surface-2/50 text-ink-muted hover:bg-surface-2 hover:text-ink'
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

              {/* Default Platforms Selection */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Default Target Platforms
                </span>
                <div className="flex gap-1.5">
                  {['META', 'GOOGLE', 'AMAZON'].map((plat) => {
                    const active = targetPlatforms.includes(plat)
                    return (
                      <button
                        key={plat}
                        type="button"
                        onClick={() => handleTogglePlatform(plat)}
                        className={cn(
                          'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors shadow-subtle',
                          active
                            ? 'bg-accent text-on-accent'
                            : 'bg-surface-2 text-ink-muted hover:bg-surface-2/80 hover:text-ink'
                        )}
                      >
                        {plat}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Reset Studio Preferences */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleResetPreferences}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line py-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-2 hover:text-danger"
                >
                  <RotateCcw className="size-3" />
                  Reset Preferences to Default
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS & MULTI-TENANCY */}
          {tab === 'diagnostics' && (
            <div className="mt-3 flex flex-col gap-3">
              {/* Multi-Tenant Scoping Notice */}
              <div className="flex items-start gap-2 rounded-xl bg-accent-soft/40 p-2.5 text-xs text-ink">
                <Info className="mt-0.5 size-4 shrink-0 text-accent" />
                <p className="text-[11px] leading-relaxed text-ink-muted">
                  <strong className="text-ink">Multi-Tenant Isolation:</strong> All books, creative sets, and generated ad copy are strictly scoped by <code className="rounded bg-surface px-1 py-0.5 font-mono text-[10px] text-accent">publisherId</code>. Cross-publisher data leakage is blocked at the query layer.
                </p>
              </div>

              {/* Switch Simulated Persona */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Simulate Tenant Persona
                </span>
                <div className="flex flex-col gap-1.5">
                  {PERSONAS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSwitchPersona(p.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl p-2 text-left text-xs transition-colors',
                        activePersona === p.id
                          ? 'bg-surface-2 ring-1 ring-accent text-ink shadow-subtle'
                          : 'bg-surface-2/40 text-ink-muted hover:bg-surface-2 hover:text-ink'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-ink">{p.name}</span>
                        <span className="font-mono text-[10px] text-ink-muted">{p.id}</span>
                      </div>
                      {activePersona === p.id ? (
                        <CheckCircle2 className="size-3.5 text-accent" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyId(p.id)
                          }}
                          className="rounded p-1 text-ink-muted hover:bg-surface hover:text-ink"
                          title="Copy ID"
                        >
                          <Copy className="size-3" />
                        </button>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Environment Info */}
              <div className="rounded-xl bg-surface-2/30 p-2.5 text-[11px] text-ink-muted">
                <div className="flex justify-between py-0.5">
                  <span>PostgreSQL Port:</span>
                  <span className="font-mono text-ink">5432 / 54322</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Server Engine:</span>
                  <span className="font-mono text-ink">Next.js 16 (Turbopack)</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Local Storage Path:</span>
                  <span className="font-mono text-ink">.local-storage/</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Strip */}
          <div className="mt-3.5 flex items-center justify-between border-t border-line/60 pt-2.5 text-[11px] text-ink-muted">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-accent hover:underline"
            >
              <Cpu className="size-3" />
              <span>Studio & MCP Settings</span>
            </Link>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                toast.success('Signed out')
                window.location.href = '/sign-in'
              }}
              className="text-danger hover:underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
