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
import { inlineMusic, musicFile } from './videoAssets'

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
