'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  BookOpen,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'

const PRESET_PUBLISHERS = [
  {
    id: 'dev-local-publisher',
    name: 'Local Publisher Studio',
    email: 'studio@publisher-toolkit.local',
    badge: 'Primary Workspace',
  },
  {
    id: 'dev-second-publisher',
    name: 'Second Publisher Co.',
    email: 'team@second-publisher.com',
    badge: 'Isolation Test Imprint',
  },
  {
    id: 'indie-press-preview',
    name: 'Indie Press Collective',
    email: 'editors@indiepress.org',
    badge: 'Demo Imprint',
  },
]

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('redirect_url') || '/'

  const [email, setEmail] = useState('')
  const [studioName, setStudioName] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(targetPublisherId?: string, targetName?: string) {
    setPending(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publisherId: targetPublisherId,
          email: email.trim() || undefined,
          studioName: targetName || studioName.trim() || undefined,
          password: password || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in')
      }

      if (targetName || studioName.trim()) {
        localStorage.setItem('pt_studio_name', targetName || studioName.trim())
      }
      if (data.publisherId) {
        localStorage.setItem('pt_tenant_persona', data.publisherId)
      }

      toast.success('Signed in successfully', {
        description: `Active as ${targetName || studioName || data.publisherId}`,
      })

      router.push(returnUrl)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Could not complete sign in')
    } finally {
      setPending(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() && !studioName.trim()) {
      setError('Please enter a publisher email or studio name')
      return
    }
    handleLogin()
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center">
        <Link href="/" className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent text-on-accent shadow-lift">
          <BookOpen className="size-6" aria-hidden />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Publisher Toolkit
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Sign in to your publisher studio to manage ads, trailers, audiobooks, and book launches.
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Publisher email or Imprint ID
            </label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-2.5 size-4 text-ink-muted" aria-hidden />
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="editor@yourimprint.com"
                className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-4 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="studioName" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Studio / Imprint name (optional)
            </label>
            <div className="relative mt-1.5">
              <Building2 className="absolute left-3 top-2.5 size-4 text-ink-muted" aria-hidden />
              <input
                id="studioName"
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder="e.g. Horizon Literary Press"
                className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-4 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Password (local dev mode accepts any)
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-2.5 size-4 text-ink-muted" aria-hidden />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-4 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={pending} className="mt-2 w-full">
            <span>Sign in to Studio</span>
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </form>

        {/* Quick Demo Personas */}
        <div className="mt-6 border-t border-line/60 pt-5">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Quick Sign-In as Demo Imprint
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {PRESET_PUBLISHERS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLogin(preset.id, preset.name)}
                disabled={pending}
                className="flex items-center justify-between rounded-xl border border-line bg-surface-2/60 p-2.5 text-left text-xs transition hover:border-accent/40 hover:bg-surface-2"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-ink">{preset.name}</span>
                  <span className="text-[11px] text-ink-muted">{preset.email}</span>
                </div>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {preset.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          <span>Local multi-tenant session with isolated storage.</span>
        </div>
      </Card>
    </div>
  )
}
