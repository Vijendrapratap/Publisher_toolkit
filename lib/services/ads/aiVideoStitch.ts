import { spawn } from 'node:child_process'

export interface StitchInput {
  clips: { path: string; durationSec: number; captionPath: string | null }[]
  endCardPath: string
  endCardSec: number
  width: number
  height: number
  outputPath: string
  /** Looped under the whole video; silence when null. */
  musicPath?: string | null
}

const FADE_SEC = 0.5

/** Scale/crop every clip to the frame, lay captions over, cross-fade everything into the end card. */
export function buildStitchArgs(input: StitchInput): string[] {
  const { width: w, height: h } = input
  const fit = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30,setsar=1,format=yuv420p`
  // AI clips keep their source image's shape (a portrait cover stays portrait),
  // so they sit whole inside the frame over a blurred fill of themselves. The
  // fill is downscaled before blurring (a cheap way to get a heavy blur — a
  // boxblur radius alone can't erase letterforms at this size) and darkened
  // slightly so it clearly reads as background, never as a second, ghosted copy.
  const fitOverBlur = (label: string, out: string) =>
    `${label}split[bg${out}][fg${out}];` +
    `[bg${out}]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
    `scale=iw/8:ih/8,boxblur=8:3,scale=${w}:${h},eq=brightness=-0.12:saturation=0.9[bgb${out}];` +
    `[fg${out}]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgs${out}];` +
    `[bgb${out}][fgs${out}]overlay=(W-w)/2:(H-h)/2,fps=30,setsar=1,format=yuv420p`
  if (input.clips.length === 0) throw new Error('At least one clip is required')
  const args: string[] = ['-y']
  const filters: string[] = []
  const segments: { label: string; durationSec: number }[] = []
  let next = 0

  input.clips.forEach((clip, i) => {
    args.push('-i', clip.path)
    const video = next++
    filters.push(`${fitOverBlur(`[${video}:v]`, String(i))},trim=duration=${clip.durationSec},setpts=PTS-STARTPTS[s${i}]`)
    if (clip.captionPath) {
      args.push('-i', clip.captionPath)
      const caption = next++
      filters.push(`[s${i}][${caption}:v]overlay=0:0:format=auto,format=yuv420p[c${i}]`)
      segments.push({ label: `c${i}`, durationSec: clip.durationSec })
    } else {
      segments.push({ label: `s${i}`, durationSec: clip.durationSec })
    }
  })

  args.push('-i', input.endCardPath)
  const end = next++
  filters.push(`[${end}:v]${fit}[end]`)
  segments.push({ label: 'end', durationSec: input.endCardSec })

  let current = segments[0].label
  let elapsed = segments[0].durationSec
  for (let i = 1; i < segments.length; i++) {
    const out = i === segments.length - 1 ? 'vout' : `x${i}`
    filters.push(`[${current}][${segments[i].label}]xfade=transition=fade:duration=${FADE_SEC}:offset=${(elapsed - FADE_SEC).toFixed(2)}[${out}]`)
    elapsed += segments[i].durationSec - FADE_SEC
    current = out
  }

  if (input.musicPath) {
    args.push('-stream_loop', '-1', '-i', input.musicPath)
    const fadeOutAt = Math.max(0, elapsed - 1.5).toFixed(2)
    filters.push(`[${next}:a]atrim=duration=${elapsed.toFixed(2)},afade=t=in:d=0.5,afade=t=out:st=${fadeOutAt}:d=1.5,volume=0.8[aout]`)
  } else {
    // Several ad placements reject a file with no audio stream.
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')
  }
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', input.musicPath ? '[aout]' : `${next}:a`, '-shortest',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-movflags', '+faststart',
    input.outputPath
  )
  return args
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
    proc.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
    proc.on('error', (err) => reject(new Error(err.message.includes('ENOENT') ? `${command} is not installed on this server.` : err.message)))
    proc.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${command} failed: ${stderr.trim().slice(-300)}`))))
  })
}

export async function stitchAiVideo(input: StitchInput): Promise<void> {
  await run('ffmpeg', buildStitchArgs(input))
}

/**
 * Clips can come back shorter than requested; trimming to the request would
 * break the fades. Never throws: a probe failure (missing binary, unreadable
 * file, garbled output) resolves NaN instead, so a stitch degrades to the
 * shot's requested duration rather than failing outright. Callers must check
 * `Number.isFinite(...) && > 0` before trusting the result.
 */
export async function probeDuration(file: string): Promise<number> {
  try {
    const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
    return Number(out.trim())
  } catch {
    return NaN
  }
}
