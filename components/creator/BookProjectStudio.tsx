'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileDown,
  Eye,
  Loader2,
  ImageIcon,
  Megaphone,
  Sparkles,
} from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChildrenBookViewer } from './ChildrenBookViewer'
import { ColoringBookViewer } from './ColoringBookViewer'
import { WordGameViewer } from './WordGameViewer'
import { StoryBookViewer } from './StoryBookViewer'
import { NovelChapterViewer } from './NovelChapterViewer'
import { BookPreviewModal } from './BookPreviewModal'
import type { BookCreatorProjectData } from '@/lib/services/creator/types'

export function BookProjectStudio({ initialProject }: { initialProject: BookCreatorProjectData }) {
  const router = useRouter()
  const [project, setProject] = useState<BookCreatorProjectData>(initialProject)
  const [sendingToAds, setSendingToAds] = useState(false)
  const [illustrating, setIllustrating] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const searchParams = useSearchParams()
  const autoIllustrated = useRef(false)

  const illustratable = Boolean(project.content)

  // Compute missing illustrations
  let missingArt = 0
  let totalArtItems = 0
  if (project.content) {
    if (project.content.type === 'children' || project.content.type === 'coloring') {
      totalArtItems = project.content.pages.length
      missingArt = project.content.pages.filter((p) => !p.generatedImageUrl).length
    } else if (project.content.type === 'word_game') {
      totalArtItems = project.content.wordSearches.length
      missingArt = project.content.wordSearches.filter((ws) => !ws.illustrationUrl).length
    } else if (project.content.type === 'short_story') {
      totalArtItems = 1
      missingArt = project.content.story.illustrationUrl ? 0 : 1
    } else if (project.content.type === 'novel_chapter') {
      totalArtItems = Math.min(project.content.novel.chapters.length, 5)
      missingArt = project.content.novel.chapters.slice(0, 5).filter((c) => !c.illustrationUrl).length
    }
  }
  if (!project.coverImageUrl) {
    missingArt += 1
    totalArtItems += 1
  }

  async function handleIllustrate() {
    setIllustrating(true)
    const toastId = toast.loading(`Generating illustrations with AI image model…`, {
      description: 'Using configured image model to illustrate covers and content pages.',
    })
    try {
      const res = await fetch(`/api/creator/projects/${project.id}/illustrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate illustrations')

      setProject(data.project)
      router.refresh()

      if (data.failures?.length) {
        toast.warning(`Illustrated ${data.succeeded} of ${data.requested}`, {
          id: toastId,
          description: `${data.failures.length} did not render. Run again to fill remaining gaps.`,
        })
      } else {
        toast.success(`Generated ${data.succeeded} illustrations!`, {
          id: toastId,
          description: 'Your book now has artwork on all pages and front cover.',
        })
      }
    } catch (err) {
      toast.error('Illustration failed', {
        id: toastId,
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setIllustrating(false)
    }
  }

  // Arriving from "Generate Book Project": draw the images straight away
  // instead of making the publisher find the button.
  useEffect(() => {
    if (autoIllustrated.current || searchParams.get('illustrate') !== '1') return
    autoIllustrated.current = true
    router.replace(`/create-book/${project.id}`)
    if (missingArt > 0) void handleIllustrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSendToAds() {
    setSendingToAds(true)
    try {
      const res = await fetch(`/api/creator/projects/${project.id}/send-to-ads`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to bridge to Ads Studio')
      }

      toast.success('Book bridged to Ads & A+ Content!', {
        description: 'Opening Amazon A+ Content and Ads Studio…',
      })
      router.push(data.redirectUrl)
    } catch (err: any) {
      toast.error('Could not send to Ads Studio', { description: err.message })
    } finally {
      setSendingToAds(false)
    }
  }

  function handleDownloadManuscript() {
    let contentString = `# ${project.title || 'Untitled Book'}\n`
    if (project.subtitle) contentString += `### ${project.subtitle}\n`
    contentString += `By ${project.author || 'Author'}\n\n`
    contentString += `---\n\n`

    if (project.content) {
      if (project.content.type === 'children') {
        project.content.pages.forEach((p) => {
          contentString += `## Page ${p.pageNumber}: ${p.spreadHeading || ''}\n\n`
          contentString += `${p.storyText}\n\n`
          if (p.generatedImageUrl) contentString += `![Page ${p.pageNumber}](${p.generatedImageUrl})\n\n`
          contentString += `---\n\n`
        })
      } else if (project.content.type === 'coloring') {
        project.content.pages.forEach((p) => {
          contentString += `## Page ${p.pageNumber}: ${p.title}\n\n`
          contentString += `${p.sceneDescription}\n\n`
          if (p.generatedImageUrl) contentString += `![Page ${p.pageNumber}](${p.generatedImageUrl})\n\n`
          contentString += `---\n\n`
        })
      } else if (project.content.type === 'novel_chapter') {
        contentString += `Premise: ${project.content.novel.premise}\n\n`
        project.content.novel.chapters.forEach((c) => {
          contentString += `## Chapter ${c.chapterNumber}: ${c.title}\n\n`
          if (c.content) {
            contentString += `${c.content}\n\n`
          } else {
            contentString += `[Draft Summary: ${c.summary}]\n\n`
          }
          contentString += `---\n\n`
        })
      } else if (project.content.type === 'short_story') {
        contentString += `${project.content.story.storyText}\n\n`
      } else if (project.content.type === 'word_game') {
        project.content.wordSearches.forEach((ws) => {
          contentString += `## Word Search #${ws.puzzleNumber}: ${ws.title}\n\n`
          contentString += `Words: ${ws.wordList.join(', ')}\n\n`
        })
      }
    }

    const blob = new Blob([contentString], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(project.title || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-manuscript.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Manuscript downloaded!')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/create-book"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Book Creator Studio
            </Link>
            <span className="text-xs text-line">•</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              {project.bookType.replace('_', ' ')}
            </span>
            {project.coverImageUrl && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Cover Art Ready
              </span>
            )}
          </div>

          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {project.title || 'Untitled Book'}
          </h1>
          {project.subtitle && <p className="text-sm text-ink-muted">{project.subtitle}</p>}
        </div>

        {/* Global Studio Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. PREVIEW BOOK BUTTON */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="size-4 text-accent" /> Preview Book
          </Button>

          {/* 2. DOWNLOAD PDF BUTTON */}
          <a
            href={`/api/creator/projects/${project.id}/pdf`}
            download
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            <FileDown className="size-4" /> Download PDF
          </a>

          {/* 3. DOWNLOAD MANUSCRIPT */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownloadManuscript}
          >
            <Download className="size-3.5" /> Manuscript (.md)
          </Button>

          {/* 4. ILLUSTRATE / GENERATE IMAGES WITH IMAGE MODEL */}
          {illustratable && (
            <Button
              type="button"
              variant={missingArt > 0 ? 'primary' : 'secondary'}
              size="sm"
              loading={illustrating}
              onClick={handleIllustrate}
            >
              <ImageIcon className="size-4" />
              {missingArt > 0 ? `Illustrate Book (${missingArt} images)` : 'Redraw with AI'}
            </Button>
          )}

          {/* 5. CREATE AMAZON ADS */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={sendingToAds}
            onClick={handleSendToAds}
          >
            {sendingToAds ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Bridging to Ads…
              </>
            ) : (
              <>
                <Megaphone className="size-4" />
                Amazon Ads & A+
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Dynamic Viewer */}
      {project.content ? (
        project.content.type === 'children' ? (
          <ChildrenBookViewer pages={project.content.pages} />
        ) : project.content.type === 'coloring' ? (
          <ColoringBookViewer pages={project.content.pages} />
        ) : project.content.type === 'word_game' ? (
          <WordGameViewer
            wordSearches={project.content.wordSearches}
            crosswords={project.content.crosswords}
          />
        ) : project.content.type === 'short_story' ? (
          <StoryBookViewer story={project.content.story} />
        ) : project.content.type === 'novel_chapter' ? (
          <NovelChapterViewer
            projectId={project.id}
            novel={project.content.novel}
            onChapterUpdated={(updatedCh) => {
              if (project.content && project.content.type === 'novel_chapter') {
                const chapters = project.content.novel.chapters.map((c) =>
                  c.chapterNumber === updatedCh.chapterNumber ? updatedCh : c
                )
                setProject({
                  ...project,
                  content: {
                    type: 'novel_chapter',
                    novel: {
                      ...project.content.novel,
                      chapters,
                    },
                  },
                  wordCount: chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0),
                })
              }
            }}
          />
        ) : null
      ) : (
        <Card className="p-8 text-center text-ink-muted">
          No content generated yet for this project.
        </Card>
      )}

      {/* Interactive Book Preview Modal */}
      <BookPreviewModal
        project={project}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  )
}
