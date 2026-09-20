import { createCanvas, loadImage, GlobalFonts, type Canvas, type Image } from '@napi-rs/canvas'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { planBeats, beatAt, typeRamp, type Beat } from './layout'
import { AD_FONT, SCENE_PAINTERS, drawBackground, type SceneAssets, type SceneInput } from './scenes'
import { getDuration, getFormat, getPreset } from './presets'

export class VideoAdRenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VideoAdRenderError'
  }
}

/** 30fps: Amazon's own creative spec, and smooth enough for text motion. */
const FPS = 30

let fontsReady = false

/**
 * The system fallback (DejaVu) has no heavy weights, so all-caps ad headlines
 * came out light and wide. Inter ships with the app and covers 100–900.
 */
function ensureFonts(): void {
  if (fontsReady) return
  const base = path.join(process.cwd(), 'node_modules/@fontsource-variable/inter/files')
  for (const file of ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2']) {
    try {
      GlobalFonts.registerFromPath(path.join(base, file), AD_FONT)
    } catch {
      // Falls back to a system sans; layout still measures correctly.
    }
  }
  fontsReady = true
}

export interface VideoAdInput {
  title: string
  author: string
  headline: string
  benefits: string[]
  ctaText: string
  preset: string
  format: string
  length: string
  coverBuffer?: Buffer | null
  interiorBuffers?: Buffer[]
  /** Optional AI-generated photographic background. */
  sceneBuffer?: Buffer | null
  rating?: number | null
  reviewCount?: number | null
  price?: string | null
}

/**
 * Paints one frame and returns it as a PNG.
 *
 * Shares the whole asset/beat/paint path with {@link renderVideoAd}, so tests
 * can cover every preset and format without encoding a video for each.
 */
export async function renderAdFrame(
  input: VideoAdInput & { atProgress: number }
): Promise<Buffer> {
  const { canvas, paintFrame, durationSec } = await prepare(input)
  paintFrame(durationSec * input.atProgress)
  return canvas.toBuffer('image/png')
}

export interface VideoAdOutput {
  videoBuffer: Buffer
  posterBuffer: Buffer
  durationSec: number
  width: number
  height: number
  format: string
  beats: Beat[]
}

async function loadOptional(buffer: Buffer | null | undefined): Promise<Image | null> {
  if (!buffer || buffer.length === 0) return null
  try {
    return await loadImage(buffer)
  } catch {
    // A corrupt upload must not take the whole ad down.
    return null
  }
}

/**
 * Renders every frame on a canvas and streams raw RGBA into ffmpeg.
 *
 * The previous engine wrote four static PNGs and cross-faded them, which is
 * why the output had no motion. Drawing per frame is what makes text reveals,
 * push-ins and the settling cover possible — and at these sizes it costs a few
 * seconds of CPU, not minutes.
 */
/** Everything both the video render and a single-frame render need. */
async function prepare(input: VideoAdInput) {
  ensureFonts()

  const preset = getPreset(input.preset)
  const format = getFormat(input.format)
  const durationSec = getDuration(input.length)
  const { width, height, tilePx } = format

  const [cover, scene, ...interiors] = await Promise.all([
    loadOptional(input.coverBuffer),
    loadOptional(input.sceneBuffer),
    ...(input.interiorBuffers ?? []).slice(0, 4).map(loadOptional),
  ])
  const assets: SceneAssets = {
    cover,
    scene,
    interiors: interiors.filter((image): image is Image => image !== null),
  }

  // A beat with nothing to show is dropped rather than painted empty.
  const available = new Set(preset.beats)
  if (assets.interiors.length === 0) available.delete('interior')
  if (!input.rating && !input.reviewCount && !input.price) available.delete('proof')
  if (input.benefits.length === 0) available.delete('benefits')

  const beats = planBeats(preset.beats, durationSec, available)
  const ramp = typeRamp(height, tilePx)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  const paintFrame = (timeSec: number) => {
    const { beat, progress } = beatAt(beats, timeSec)
    const sceneInput: SceneInput = {
      ctx,
      width,
      height,
      ramp,
      preset,
      assets,
      title: input.title,
      author: input.author,
      headline: input.headline,
      benefits: input.benefits,
      ctaText: input.ctaText,
      rating: input.rating ?? null,
      reviewCount: input.reviewCount ?? null,
      price: input.price ?? null,
      progress,
      globalProgress: durationSec > 0 ? timeSec / durationSec : 0,
    }
    ctx.clearRect(0, 0, width, height)
    drawBackground(sceneInput)
    SCENE_PAINTERS[beat.kind](sceneInput)
  }

  return { canvas, paintFrame, beats, durationSec, width, height, format }
}

/**
 * Renders every frame on a canvas and streams raw RGBA into ffmpeg.
 *
 * The previous engine wrote four static PNGs and cross-faded them, which is
 * why the output had no motion. Drawing per frame is what makes text reveals,
 * push-ins and the settling cover possible — and at these sizes it costs a few
 * seconds of CPU, not minutes.
 */
export async function renderVideoAd(input: VideoAdInput): Promise<VideoAdOutput> {
  const { canvas, paintFrame, beats, durationSec, width, height, format } = await prepare(input)

  const totalFrames = Math.round(durationSec * FPS)
  const videoBuffer = await encode({ width, height, totalFrames, paintFrame, canvas })

  // Poster: the hook beat settled, which is what the carousel shows before play.
  paintFrame(beats[0].durationSec * 0.85)
  const posterBuffer = canvas.toBuffer('image/png')

  return { videoBuffer, posterBuffer, durationSec, width, height, format: format.key, beats }
}

interface EncodeInput {
  width: number
  height: number
  totalFrames: number
  paintFrame: (timeSec: number) => void
  canvas: Canvas
}

/**
 * Raw RGBA over stdin avoids encoding a PNG per frame — for a 15s square ad
 * that is 450 PNG compressions we simply do not need to pay for.
 */
function encode({ width, height, totalFrames, paintFrame, canvas }: EncodeInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'ffmpeg',
      [
        '-f', 'rawvideo',
        '-pixel_format', 'rgba',
        '-video_size', `${width}x${height}`,
        '-framerate', String(FPS),
        '-i', 'pipe:0',
        // Silent AAC track: several placements reject a video with no audio
        // stream at all, and these ads are watched muted anyway.
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-shortest',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        // faststart moves the index to the front so the ad starts playing
        // before it has fully downloaded.
        '-movflags', 'frag_keyframe+empty_moov+faststart',
        '-f', 'mp4',
        'pipe:1',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )

    const chunks: Buffer[] = []
    let stderr = ''
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('error', (err) =>
      reject(
        new VideoAdRenderError(
          err.message.includes('ENOENT')
            ? 'ffmpeg is not installed on this server, so video cannot be rendered.'
            : `ffmpeg could not be started: ${err.message}`
        )
      )
    )

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new VideoAdRenderError(`ffmpeg exited with code ${code}: ${stderr.trim().slice(-300)}`))
        return
      }
      const output = Buffer.concat(chunks)
      if (output.length === 0) {
        reject(new VideoAdRenderError('ffmpeg produced an empty file'))
        return
      }
      resolve(output)
    })

    // Backpressure-aware write loop: without it a 1080p ad buffers every frame
    // in memory before ffmpeg has consumed any of them.
    let frame = 0
    const writeNext = () => {
      while (frame < totalFrames) {
        paintFrame(frame / FPS)
        frame++
        if (!proc.stdin.write(canvas.data())) {
          proc.stdin.once('drain', writeNext)
          return
        }
      }
      proc.stdin.end()
    }

    proc.stdin.on('error', () => {
      // ffmpeg closed the pipe; the close handler reports the real reason.
    })
    writeNext()
  })
}
