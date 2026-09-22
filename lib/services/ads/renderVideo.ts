import path from 'node:path'
import os from 'node:os'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'

export class AdVideoRenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdVideoRenderError'
  }
}

export function bundleDir(): string {
  return process.env.REMOTION_BUNDLE_DIR ?? path.join(process.cwd(), '.remotion-bundle')
}

export interface RenderedAdVideo {
  videoBuffer: Buffer
  posterBuffer: Buffer
  durationSec: number
  width: number
  height: number
}

async function prepare(inputProps: Record<string, unknown>, compositionId: string) {
  const serveUrl = bundleDir()
  if (!existsSync(path.join(serveUrl, 'index.html'))) {
    throw new AdVideoRenderError('The video bundle is missing. Run `npm run remotion:bundle` and try again.')
  }
  const renderer = await import('@remotion/renderer')
  await renderer.ensureBrowser()
  const composition = await renderer.selectComposition({ serveUrl, id: compositionId, inputProps })
  return { renderer, serveUrl, composition }
}

function asRenderError(err: unknown): AdVideoRenderError {
  if (err instanceof AdVideoRenderError) return err
  return new AdVideoRenderError(err instanceof Error ? err.message : 'Video rendering failed')
}

/** Renders a composition from the prebuilt bundle — the same component the browser preview plays. */
export async function renderAdVideo(inputProps: Record<string, unknown>, compositionId = 'AdVideo'): Promise<RenderedAdVideo> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ad-video-'))
  try {
    const { renderer, serveUrl, composition } = await prepare(inputProps, compositionId)
    const videoPath = path.join(dir, 'video.mp4')
    const posterPath = path.join(dir, 'poster.png')
    // Several ad placements reject a file with no audio stream at all.
    await renderer.renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: videoPath, inputProps, enforceAudioTrack: true })
    await renderer.renderStill({ composition, serveUrl, output: posterPath, inputProps, frame: Math.floor(composition.durationInFrames * 0.6) })
    const [videoBuffer, posterBuffer] = await Promise.all([readFile(videoPath), readFile(posterPath)])
    return {
      videoBuffer,
      posterBuffer,
      durationSec: composition.durationInFrames / composition.fps,
      width: composition.width,
      height: composition.height,
    }
  } catch (err) {
    throw asRenderError(err)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** A single PNG frame; transparent where the composition draws nothing. */
export async function renderStillPng(inputProps: Record<string, unknown>, compositionId: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ad-still-'))
  try {
    const { renderer, serveUrl, composition } = await prepare(inputProps, compositionId)
    const output = path.join(dir, 'still.png')
    await renderer.renderStill({ composition, serveUrl, output, inputProps, imageFormat: 'png' })
    return await readFile(output)
  } catch (err) {
    throw asRenderError(err)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
