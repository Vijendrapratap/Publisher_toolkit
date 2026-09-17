'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Headphones,
  Sparkles,
  Mic,
  Gauge,
  Music,
  Check,
  ListMusic,
  Plus,
  Trash2,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea, Field } from '@/components/ui/field'
import { cn } from '@/components/ui/cn'
import {
  TTS_ENGINE_OPTIONS,
  VOICE_MODELS,
  AUDIO_FORMAT_OPTIONS,
  PACING_OPTIONS,
  type TtsEngineKey,
  type VoiceModelKey,
  type AudioFormatKey,
} from '@/lib/services/audiobook/options'

export interface AudiobookChapterInput {
  id?: string
  chapterNumber: number
  title: string
  content: string
}

export function AudiobookConfigureForm({
  projectId,
  initial,
  book,
}: {
  projectId: string
  initial: {
    ttsProvider: TtsEngineKey
    voiceModel: string
    voicePacing: number
    audioFormat: AudioFormatKey
    chapters: AudiobookChapterInput[]
  }
  book: { title: string; author: string; blurb: string; coverUrl?: string | null }
}) {
  const router = useRouter()
  const [ttsProvider, setTtsProvider] = useState<TtsEngineKey>(initial.ttsProvider || 'fishaudio')
  const [voiceModel, setVoiceModel] = useState<string>(initial.voiceModel || 'warm-literary')
  const [voicePacing, setVoicePacing] = useState<number>(initial.voicePacing || 1.0)
  const [audioFormat, setAudioFormat] = useState<AudioFormatKey>(initial.audioFormat || 'mp3')
  const [chapters, setChapters] = useState<AudiobookChapterInput[]>(
    initial.chapters.length > 0
      ? initial.chapters
      : [{ chapterNumber: 1, title: 'Chapter 1', content: book.blurb || 'Sample chapter text' }]
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateChapter = (index: number, field: 'title' | 'content', value: string) => {
    setChapters((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addChapter = () => {
    const nextNum = chapters.length + 1
    setChapters((prev) => [
      ...prev,
      {
        chapterNumber: nextNum,
        title: `Chapter ${nextNum}`,
        content: '',
      },
    ])
  }

  const removeChapter = (index: number) => {
    if (chapters.length <= 1) {
      toast.error('An audiobook requires at least one chapter.')
      return
    }
    setChapters((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((ch, i) => ({ ...ch, chapterNumber: i + 1 }))
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (chapters.some((c) => !c.title.trim() || !c.content.trim())) {
      setError('All chapters must have both a title and narrative content.')
      return
    }

    setPending(true)
    setError(null)

    const res = await fetch(`/api/audiobook/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ttsProvider,
        voiceModel,
        voicePacing,
        audioFormat,
        chapters,
      }),
    })

    if (!res.ok) {
      setPending(false)
      const message = (await res.json().catch(() => ({}))).error ?? 'Failed to save configuration.'
      setError(message)
      toast.error(message)
      return
    }

    router.push(`/audiobook/${projectId}/generate`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {/* TTS Engine Selection */}
      <Card className="p-6">
        <fieldset>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <legend className="flex items-center gap-2 font-display text-lg font-semibold">
              <Mic className="size-5 text-accent" aria-hidden /> Neural TTS Engine
            </legend>
            <span className="text-xs text-ink-muted">Fish Audio, Qwen TTS, or Studio Neutral</span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Select the voice synthesis provider powering your audiobook narration.
          </p>

          <div role="radiogroup" aria-label="TTS Engine" className="mt-4 grid gap-3 sm:grid-cols-3">
            {TTS_ENGINE_OPTIONS.map((engine) => {
              const selected = ttsProvider === engine.key
              return (
                <button
                  key={engine.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTtsProvider(engine.key)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/50 ring-2 ring-accent/30 shadow-subtle'
                      : 'border-line/60 bg-surface hover:border-accent/40 shadow-subtle'
                  )}
                >
                  <span
                    className={cn(
                      'absolute right-3 top-3 grid size-5 place-items-center rounded-full border',
                      selected ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface-2'
                    )}
                  >
                    {selected && <Check className="size-3" aria-hidden />}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                      {engine.badge}
                    </span>
                  </div>
                  <span className="font-semibold text-sm">{engine.label}</span>
                  <span className="text-xs text-ink-muted leading-relaxed">{engine.description}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* Voice Models */}
      <Card className="p-6">
        <fieldset>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <legend className="flex items-center gap-2 font-display text-lg font-semibold">
              <Headphones className="size-5 text-accent" aria-hidden /> Narrator Voice Model
            </legend>
            <span className="text-xs text-ink-muted">Trained voice personas matching your genre</span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Select a narrator voice tuned for storytelling, character dialogue, and emotional nuance.
          </p>

          <div role="radiogroup" aria-label="Voice Model" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VOICE_MODELS.map((vm) => {
              const selected = voiceModel === vm.key
              return (
                <button
                  key={vm.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setVoiceModel(vm.key)}
                  className={cn(
                    'relative flex flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 ring-2 ring-accent/30 shadow-subtle'
                      : 'border-line/60 bg-surface hover:border-accent/40 shadow-subtle'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{vm.name}</span>
                      <span
                        className={cn(
                          'grid size-5 place-items-center rounded-full border',
                          selected ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface-2'
                        )}
                      >
                        {selected && <Check className="size-3" aria-hidden />}
                      </span>
                    </div>
                    <span className="text-xs text-accent font-medium">{vm.tone}</span>
                    <p className="mt-2 text-xs italic text-ink-muted leading-relaxed">
                      &ldquo;{vm.previewText}&rdquo;
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1 border-t border-line/40 pt-2">
                    {vm.bestFor.slice(0, 2).map((genre) => (
                      <span key={genre} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-ink-muted">
                        {genre}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* Pacing & Format */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <fieldset>
            <legend className="flex items-center gap-2 font-display text-base font-semibold">
              <Gauge className="size-4 text-accent" aria-hidden /> Narration Pacing
            </legend>
            <p className="mt-1 text-xs text-ink-muted">Playback cadence and narrative tempo</p>
            <div role="radiogroup" className="mt-3 grid grid-cols-2 gap-2">
              {PACING_OPTIONS.map((p) => {
                const selected = voicePacing === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setVoicePacing(p.key)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all',
                      selected
                        ? 'border-accent bg-accent text-on-accent font-semibold shadow-subtle'
                        : 'border-line/60 bg-surface hover:border-accent/40'
                    )}
                  >
                    <span className="font-semibold text-sm">{p.label}</span>
                    <span className={cn('text-[10px]', selected ? 'text-on-accent/80' : 'text-ink-muted')}>
                      {p.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </Card>

        <Card className="p-6">
          <fieldset>
            <legend className="flex items-center gap-2 font-display text-base font-semibold">
              <Music className="size-4 text-accent" aria-hidden /> Audio Format
            </legend>
            <p className="mt-1 text-xs text-ink-muted">Output encoding for Audible & Apple Books</p>
            <div role="radiogroup" className="mt-3 grid grid-cols-2 gap-2">
              {AUDIO_FORMAT_OPTIONS.map((f) => {
                const selected = audioFormat === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAudioFormat(f.key)}
                    className={cn(
                      'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                      selected
                        ? 'border-accent bg-accent-soft/60 ring-2 ring-accent/30 shadow-subtle'
                        : 'border-line/60 bg-surface hover:border-accent/40'
                    )}
                  >
                    <span className="font-semibold text-sm">{f.label}</span>
                    <span className="mt-1 text-[11px] text-ink-muted">{f.description}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </Card>
      </div>

      {/* Chapter Manager */}
      <Card className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
              <ListMusic className="size-5 text-accent" aria-hidden /> Chapter Structure ({chapters.length} chapters)
            </h3>
            <p className="text-xs text-ink-muted">
              Review and edit chapter titles and manuscript text prior to synthesis.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addChapter} className="self-start sm:self-auto">
            <Plus className="size-4" /> Add Chapter
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {chapters.map((ch, idx) => {
            const wordCount = ch.content.trim().split(/\s+/).filter(Boolean).length
            const estSec = Math.round((wordCount / (150 * voicePacing)) * 60)
            const estMin = Math.floor(estSec / 60)
            const estRemainder = estSec % 60

            return (
              <div
                key={idx}
                className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-2/40 p-4 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="grid size-6 place-items-center rounded-md bg-accent/15 font-mono text-xs font-semibold text-accent">
                      {idx + 1}
                    </span>
                    <input
                      value={ch.title}
                      onChange={(e) => updateChapter(idx, 'title', e.target.value)}
                      placeholder={`Chapter ${idx + 1} Title`}
                      className="w-full max-w-sm rounded-lg border border-line/60 bg-surface px-3 py-1.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-xs text-ink-muted">
                      {wordCount} words • ~{estMin}m {estRemainder}s
                    </span>
                    {chapters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeChapter(idx)}
                        className="p-1 text-ink-muted hover:text-danger transition-colors"
                        title="Delete Chapter"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                <Textarea
                  value={ch.content}
                  onChange={(e) => updateChapter(idx, 'content', e.target.value)}
                  rows={4}
                  placeholder="Chapter narrative content..."
                  className="text-xs font-serif leading-relaxed"
                  required
                />
              </div>
            )
          })}
        </div>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-ink-muted">
          {chapters.length} chapter{chapters.length === 1 ? '' : 's'} ready for synthesis
        </span>
        <Button type="submit" size="lg" loading={pending}>
          <Sparkles className="size-4" aria-hidden /> Synthesize Audiobook
        </Button>
      </div>
    </form>
  )
}
