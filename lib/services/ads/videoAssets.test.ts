import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/storage', () => ({
  readStoredFile: vi.fn(async (url: string) => ({ data: Buffer.from(`bytes:${url}`), contentType: 'audio/mpeg' })),
  toDataUri: vi.fn(({ data, contentType }: { data: Buffer; contentType: string }) => `data:${contentType};base64,${data.toString('base64')}`),
}))
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  writeFile: vi.fn(async () => {}),
}))

import { readStoredFile } from '@/lib/providers/storage'
import { writeFile } from 'node:fs/promises'
import { bookAdImages, inlineMusic, musicFile } from './videoAssets'
import { fixedStoryboard } from './storyboard'
import { presetStyle } from './videoSpec'

const ownedUpload = { kind: 'upload' as const, url: '/api/files/ads/pub_1/music/track.mp3', name: 'track.mp3' }
const foreignUpload = { kind: 'upload' as const, url: '/api/files/ads/pub_evil/music/track.mp3', name: 'track.mp3' }

beforeEach(() => vi.clearAllMocks())

describe('inlineMusic', () => {
  it('inlines an uploaded track that belongs to this publisher', async () => {
    const uri = await inlineMusic(ownedUpload, 'pub_1')
    expect(uri).toMatch(/^data:audio\/mpeg;base64,/)
    expect(readStoredFile).toHaveBeenCalledWith(ownedUpload.url)
  })

  it("treats another publisher's uploaded track as no music, without reading it", async () => {
    const uri = await inlineMusic(foreignUpload, 'pub_1')
    expect(uri).toBeNull()
    expect(readStoredFile).not.toHaveBeenCalled()
  })

  it('inlines a bundled library track regardless of publisher', async () => {
    const uri = await inlineMusic({ kind: 'library', track: 'epic' }, 'pub_1')
    expect(uri).toMatch(/^data:audio\/mpeg;base64,/)
  })
})

describe('musicFile', () => {
  it("copies an uploaded track that belongs to this publisher's dir", async () => {
    const file = await musicFile(ownedUpload, '/tmp/dir', 'pub_1')
    expect(file).toBe('/tmp/dir/music-upload')
    expect(writeFile).toHaveBeenCalled()
  })

  it("treats another publisher's uploaded track as no music, without reading or writing it", async () => {
    const file = await musicFile(foreignUpload, '/tmp/dir', 'pub_1')
    expect(file).toBeNull()
    expect(readStoredFile).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })
})

describe('bookAdImages', () => {
  const style = presetStyle('cinematic')
  const book = { frontCoverUrl: '/api/files/c.png', interiorImageUrls: ['/p1', '/p2', '/p3', '/p4'] }
  it('inlines the cover, only the pages the storyboard shows, and the owned setting', async () => {
    const storyboard = {
      ...fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style }),
      beats: [
        { kind: 'pageZoom' as const, page: 3, focus: { x: 0.5, y: 0.5, zoom: 1.5 }, seconds: 3 },
        { kind: 'endCard' as const, title: 'T', cta: 'Go', seconds: 3 },
      ],
    }
    storyboard.theme = { ...storyboard.theme, settingImageUrl: '/api/files/ads/pub_1/settings/s.png' }
    const out = await bookAdImages(book, storyboard, 'pub_1')
    expect(out.coverUrl).toMatch(/^data:/)
    expect(out.pageUrls.map(Boolean)).toEqual([false, false, true, false])
    expect(out.settingUrl).toMatch(/^data:/)
  })
  it('never reads a setting picture another publisher owns', async () => {
    const storyboard = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
    storyboard.theme = { ...storyboard.theme, settingImageUrl: '/api/files/ads/pub_2/settings/s.png' }
    expect((await bookAdImages(book, storyboard, 'pub_1')).settingUrl).toBeNull()
    expect(readStoredFile).not.toHaveBeenCalledWith('/api/files/ads/pub_2/settings/s.png')
  })
})
