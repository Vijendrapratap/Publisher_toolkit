import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildStitchArgs, probeDuration, stitchAiVideo } from './aiVideoStitch'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

describe('buildStitchArgs', () => {
  const args = buildStitchArgs({
    clips: [
      { path: 'a.mp4', durationSec: 5, captionPath: 'cap-a.png' },
      { path: 'b.mp4', durationSec: 5, captionPath: null },
    ],
    endCardPath: 'end.mp4',
    endCardSec: 3,
    width: 1920,
    height: 1080,
    outputPath: 'out.mp4',
  })
  const graph = args[args.indexOf('-filter_complex') + 1]

  it('keeps each whole clip inside the frame over a blurred fill, and overlays captions', () => {
    expect(graph).toContain('[0:v]split[bg0][fg0]')
    expect(graph).toContain('[bg0]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=24:2')
    expect(graph).toContain('[fg0]scale=1920:1080:force_original_aspect_ratio=decrease')
    expect(graph).toContain('[s0][1:v]overlay=0:0')
  })
  it('cross-fades clips into the end card at the right offsets', () => {
    expect(graph).toContain('xfade=transition=fade:duration=0.5:offset=4.50')
    expect(graph).toContain('xfade=transition=fade:duration=0.5:offset=9.00[vout]')
  })
  it('loops the music under the whole video with fades', () => {
    const withMusic = buildStitchArgs({
      clips: [{ path: 'a.mp4', durationSec: 5, captionPath: null }],
      endCardPath: 'end.mp4', endCardSec: 3, width: 1080, height: 1080, outputPath: 'o.mp4', musicPath: 'epic.mp3',
    })
    expect(withMusic.join(' ')).toContain('-stream_loop -1 -i epic.mp3')
    const g = withMusic[withMusic.indexOf('-filter_complex') + 1]
    expect(g).toContain('atrim=duration=7.50,afade=t=in:d=0.5,afade=t=out:st=6.00:d=1.5')
    expect(withMusic).toContain('[aout]')
    expect(withMusic.join(' ')).not.toContain('anullsrc')
  })

  it('maps the video and a silent audio track to the output', () => {
    expect(args).toContain('[vout]')
    expect(args.at(-1)).toBe('out.mp4')
    expect(args.join(' ')).toContain('anullsrc')
  })
})

describe.skipIf(!hasFfmpeg)('stitchAiVideo', () => {
  it('produces one file of the combined length', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'stitch-'))
    try {
      const make = (name: string, colour: string, seconds: number) => {
        const file = path.join(dir, name)
        spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=${colour}:s=320x240:d=${seconds}:r=30`, '-pix_fmt', 'yuv420p', file])
        return file
      }
      const outputPath = path.join(dir, 'out.mp4')
      await stitchAiVideo({
        clips: [
          { path: make('a.mp4', 'red', 2), durationSec: 2, captionPath: null },
          { path: make('b.mp4', 'green', 2), durationSec: 2, captionPath: null },
        ],
        endCardPath: make('end.mp4', 'blue', 2),
        endCardSec: 2,
        width: 640,
        height: 360,
        outputPath,
      })
      expect(await probeDuration(outputPath)).toBeCloseTo(5, 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
