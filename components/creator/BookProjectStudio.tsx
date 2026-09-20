'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  BookOpen,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  ImageIcon,
  Megaphone,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChildrenBookViewer } from './ChildrenBookViewer'
import { ColoringBookViewer } from './ColoringBookViewer'
import { WordGameViewer } from './WordGameViewer'
import { NovelChapterViewer } from './NovelChapterViewer'
import type { BookCreatorProjectData } from '@/lib/services/creator/types'

export function BookProjectStudio({ initialProject }: { initialProject: BookCreatorProjectData }) {
  const router = useRouter()
  const [project, setProject] = useState<BookCreatorProjectData>(initialProject)
  const [sendingToAds, setSendingToAds] = useState(false)
  const [illustrating, setIllustrating] = useState(false)

  const illustratable = project.content?.type === 'children' || project.content?.type === 'coloring'
  const pageCount = illustratable && project.content ? ('pages' in project.content ? project.content.pages.length : 0) : 0
  const missingArt =
    illustratable && project.content && 'pages' in project.content
      ? project.content.pages.filter((p) => !p.generatedImageUrl).length
      : 0

  async function handleIllustrate() {
    setIllustrating(true)
    // A long, paid job: say what it will cost before it starts, not after.
    const toastId = toast.loading(`Illustrating ${missingArt || pageCount} pages…`, {
      description: 'Each page is drawn separately. This can take a few minutes.',
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
          description: `${data.failures.length} did not render. Run it again to fill the gaps.`,
        })
      } else {
        toast.success(`Illustrated ${data.succeeded} images`, {
          id: toastId,
          description: 'Your book now has artwork on every page.',
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
          contentString += `> Illustration Prompt: ${p.illustrationPrompt}\n\n---\n\n`
        })
      } else if (project.content.type === 'coloring') {
        project.content.pages.forEach((p) => {
          contentString += `## Page ${p.pageNumber}: ${p.title}\n\n`
          contentString += `${p.sceneDescription}\n\n`
          contentString += `> Line Art Prompt: ${p.lineArtPrompt}\n\n---\n\n`
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
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="size-3.5" /> Book Creator Studio
            </Link>
            <span className="text-xs text-line">•</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              {project.bookType.replace('_', ' ')}
            </span>
          </div>

          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {project.title || 'Untitled Book'}
          </h1>
          {project.subtitle && <p className="text-sm text-ink-muted">{project.subtitle}</p>}
        </div>

        {/* Global Studio Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDownloadManuscript}
          >
            <Download className="size-4" /> Download Manuscript
          </Button>

          {illustratable && (
            <Button
              type="button"
              variant={missingArt > 0 ? 'primary' : 'secondary'}
              size="sm"
              loading={illustrating}
              onClick={handleIllustrate}
            >
              <ImageIcon className="size-4" />
              {missingArt > 0 ? `Illustrate ${missingArt} pages` : 'Redraw illustrations'}
            </Button>
          )}

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
                Create Amazon Ads & A+ Content
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
        ) : project.content.type === 'short_story' ? (
          <Card className="p-8 font-serif leading-relaxed text-lg sm:text-xl text-ink whitespace-pre-wrap">
            <h2 className="font-display text-2xl font-bold mb-4 not-italic">
              {project.content.story.title}
            </h2>
            {project.content.story.storyText}
          </Card>
        ) : null
      ) : (
        <Card className="p-8 text-center text-ink-muted">
          No content generated yet for this project.
        </Card>
      )}
    </div>
  )
}
