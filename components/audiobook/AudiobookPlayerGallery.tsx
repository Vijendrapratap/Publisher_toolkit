'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  FileArchive,
  Volume2,
  VolumeX,
  Headphones,
  Check,
  Music,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { toast } from 'sonner'

export interface AudiobookChapterItem {
  id: string
  chapterNumber: number
  title: string
  audioUrl?: string | null
  duration: number
}

export function AudiobookPlayerGallery({
  projectId,
  title,
  author,
  coverUrl,
  ttsProvider,
  voiceModel,
  totalDuration,
  fullAudioUrl,
  chapters,
}: {
  projectId: string
  title: string
  author: string
  coverUrl?: string | null
  ttsProvider: string
  voiceModel: string
  totalDuration: number
  fullAudioUrl?: string | null
  chapters: AudiobookChapterItem[]
}) {
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const activeChapter = chapters[activeChapterIndex] ?? chapters[0]

  // Update audio source when active chapter changes
  useEffect(() => {
    if (audioRef.current && activeChapter?.audioUrl) {
      audioRef.current.src = activeChapter.audioUrl
      audioRef.current.playbackRate = playbackRate
      if (isPlaying) {
        audioRef.current.play().catch(() => {})
      }
    }
  }, [activeChapterIndex, activeChapter?.audioUrl])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }

  const skipSeconds = (seconds: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration))
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = val
      setCurrentTime(val)
    }
  }

  const cyclePlaybackRate = () => {
    const rates = [1.0, 1.25, 1.5, 2.0, 0.85]
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length
    const nextRate = rates[nextIdx]
    setPlaybackRate(nextRate)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const selectChapter = (index: number) => {
    setActiveChapterIndex(index)
    setIsPlaying(true)
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const totalMinutes = Math.floor(totalDuration / 60)
  const totalSeconds = totalDuration % 60

  return (
    <div className="flex flex-col gap-6">
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration || activeChapter?.duration || 0)}
        onEnded={() => {
          if (activeChapterIndex < chapters.length - 1) {
            selectChapter(activeChapterIndex + 1)
          } else {
            setIsPlaying(false)
          }
        }}
      />

      {/* Main Player Showcase Card */}
      <Card className="overflow-hidden p-0 border border-line/70 bg-surface shadow-card">
        <div className="flex flex-col md:flex-row">
          {/* Album Cover Art */}
          <div className="relative flex items-center justify-center bg-black/90 p-8 md:w-[320px] shrink-0">
            <div className="relative aspect-[2/3] w-48 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-surface-2 p-4 text-center">
                  <Headphones className="size-10 text-accent opacity-40" />
                  <span className="mt-2 text-xs font-semibold">{title}</span>
                  <span className="text-[10px] text-ink-muted">{author}</span>
                </div>
              )}
            </div>
          </div>

          {/* Player Controls & Track Info */}
          <div className="flex flex-1 flex-col justify-between p-6 md:p-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent flex items-center gap-1">
                  <Sparkles className="size-3" /> {ttsProvider === 'fishaudio' ? 'Fish Audio' : ttsProvider === 'qwen' ? 'Qwen TTS' : 'Studio Narrator'}
                </span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted">
                  Voice: <strong className="text-ink capitalize">{voiceModel.replace('-', ' ')}</strong>
                </span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted">
                  Total: {totalMinutes}m {totalSeconds}s
                </span>
              </div>

              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">{title}</h2>
              <p className="text-sm text-ink-muted">Narrated by {voiceModel.replace('-', ' ')} • Book by {author || 'Unknown'}</p>

              <div className="mt-4 rounded-xl bg-surface-2/60 p-3 text-xs text-ink flex items-center justify-between">
                <span>
                  Now Playing: <strong className="font-semibold">{activeChapter?.title || 'Chapter'}</strong>
                </span>
                <span className="font-mono text-ink-muted">
                  Track {activeChapterIndex + 1} of {chapters.length}
                </span>
              </div>
            </div>

            {/* Scrubber & Controls */}
            <div className="mt-6 flex flex-col gap-3">
              {/* Scrubber Bar */}
              <div className="flex flex-col gap-1">
                <input
                  type="range"
                  min={0}
                  max={duration || activeChapter?.duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-3 accent-accent"
                />
                <div className="flex justify-between text-xs font-mono text-ink-muted">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration || activeChapter?.duration || 0)}</span>
                </div>
              </div>

              {/* Main Playback Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-mono font-semibold text-ink-muted hover:text-ink transition-colors"
                  title="Playback Speed"
                >
                  {playbackRate}×
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => skipSeconds(-15)}
                    className="p-2 text-ink-muted hover:text-ink transition-colors"
                    title="Rewind 15 seconds"
                  >
                    <RotateCcw className="size-5" />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex size-12 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg transition-transform hover:scale-105 active:scale-95"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="size-6" /> : <Play className="size-6 ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => skipSeconds(15)}
                    className="p-2 text-ink-muted hover:text-ink transition-colors"
                    title="Skip 15 seconds"
                  >
                    <RotateCw className="size-5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-2 text-ink-muted hover:text-ink transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Chapters & Tracks Table */}
      <Card className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Music className="size-5 text-accent" /> Audiobook Chapter Tracks ({chapters.length})
            </h3>
            <p className="text-xs text-ink-muted">
              Stream or download individual tracks with chapter metadata.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a href={`/api/audiobook/projects/${projectId}/download`} download className="inline-flex">
              <Button variant="primary" size="sm">
                <FileArchive className="size-4" /> Download Complete ZIP
              </Button>
            </a>
          </div>
        </div>

        <div className="mt-5 divide-y divide-line/40">
          {chapters.map((ch, idx) => {
            const isCurrent = activeChapterIndex === idx
            return (
              <div
                key={ch.id}
                className={cn(
                  'flex items-center justify-between py-3 px-3 rounded-xl transition-colors',
                  isCurrent ? 'bg-accent-soft/40 ring-1 ring-accent/30' : 'hover:bg-surface-2/60'
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => selectChapter(idx)}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-full transition-transform',
                      isCurrent && isPlaying ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink hover:scale-105'
                    )}
                  >
                    {isCurrent && isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
                  </button>

                  <div className="flex flex-col min-w-0">
                    <span className={cn('text-sm font-semibold truncate', isCurrent ? 'text-accent' : 'text-ink')}>
                      {ch.chapterNumber}. {ch.title}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {Math.floor(ch.duration / 60)}m {ch.duration % 60}s
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/audiobook/projects/${projectId}/download?chapterId=${ch.id}`}
                    download
                    className="p-2 text-ink-muted hover:text-accent transition-colors"
                    title={`Download Chapter ${ch.chapterNumber}`}
                  >
                    <Download className="size-4" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
