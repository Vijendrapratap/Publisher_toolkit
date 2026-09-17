import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { renderTrailerVideoAndPoster } from '@/lib/services/trailer/video'
import { readStoredFile, storeFile } from '@/lib/providers/storage'
import type {
  TrailerAspectRatio,
  TrailerLength,
  TrailerMusicMood,
  TrailerStyle,
} from '@/lib/services/trailer/options'
import { prisma } from '@/lib/db'

export const maxDuration = 300

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  let coverBuffer: Buffer | null = null
  if (project.frontCoverUrl) {
    try {
      const stored = await readStoredFile(project.frontCoverUrl)
      coverBuffer = stored.data
    } catch {
      coverBuffer = null
    }
  }

  const aspectRatios = project.aspectRatios.length > 0 ? project.aspectRatios : ['9:16', '1:1', '16:9']

  try {
    const trailersData: {
      aspectRatio: string
      videoUrl: string
      posterUrl: string
      duration: number
      width: number
      height: number
    }[] = []

    for (const ar of aspectRatios) {
      const aspectSlug = ar.replace(':', 'x')
      const output = await renderTrailerVideoAndPoster({
        title: project.title ?? 'Untitled Book',
        author: project.author ?? '',
        blurb: project.blurb ?? '',
        length: (project.length as TrailerLength) ?? '30s',
        style: (project.style as TrailerStyle) ?? 'cinematic',
        musicMood: (project.musicMood as TrailerMusicMood) ?? 'suspenseful',
        aspectRatio: ar as TrailerAspectRatio,
        coverPngBuffer: coverBuffer,
        hookText: project.hookText,
        ctaText: project.ctaText,
      })

      const [videoFile, posterFile] = await Promise.all([
        storeFile(
          `trailer/${publisherId}/trailers/${project.id}/${aspectSlug}.mp4`,
          output.videoBuffer,
          'video/mp4'
        ),
        storeFile(
          `trailer/${publisherId}/posters/${project.id}/${aspectSlug}.png`,
          output.posterBuffer,
          'image/png'
        ),
      ])

      trailersData.push({
        aspectRatio: ar,
        videoUrl: videoFile.url,
        posterUrl: posterFile.url,
        duration: output.durationSec,
        width: output.width,
        height: output.height,
      })
    }

    // Clean up previous trailers if regenerating
    await prisma.generatedTrailer.deleteMany({ where: { projectId: project.id } })

    await prisma.trailerProject.update({
      where: { id: project.id },
      data: {
        status: 'generated',
        trailers: {
          createMany: {
            data: trailersData,
          },
        },
      },
    })

    return NextResponse.json({ success: true, count: trailersData.length }, { status: 201 })
  } catch (err) {
    console.error('trailer generation failed', err)
    return NextResponse.json(
      { error: "We couldn't generate your trailer videos. Please try again." },
      { status: 500 }
    )
  }
}
