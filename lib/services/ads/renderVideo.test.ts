import { describe, it, expect, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { AdVideoRenderError, renderAdVideo } from './renderVideo'
import { defaultVideoSpec } from './videoSpec'

const realBundle = path.join(process.cwd(), '.remotion-bundle', 'index.html')

afterEach(() => {
  delete process.env.REMOTION_BUNDLE_DIR
})

describe('renderAdVideo', () => {
  it('explains how to fix a missing bundle', async () => {
    process.env.REMOTION_BUNDLE_DIR = '/nonexistent/remotion-bundle'
    const attempt = renderAdVideo({})
    await expect(attempt).rejects.toBeInstanceOf(AdVideoRenderError)
    await expect(renderAdVideo({})).rejects.toThrow(/remotion:bundle/)
  })

  it.skipIf(!existsSync(realBundle))(
    'renders an MP4 and a poster from the prebuilt bundle',
    async () => {
      const spec = { ...defaultVideoSpec({ title: 'Smoke Test', blurb: 'A short line.' }), length: '6s' as const, format: '1:1' as const }
      const out = await renderAdVideo({ spec, title: 'Smoke Test', author: 'Tester', coverUrl: null, interiorImageUrls: [] })
      expect(out.videoBuffer.subarray(4, 8).toString()).toBe('ftyp')
      expect(out.posterBuffer.subarray(1, 4).toString()).toBe('PNG')
      expect(out.durationSec).toBe(6)
      expect(out.width).toBe(1080)
      expect(out.height).toBe(1080)
    },
    240_000
  )
})
