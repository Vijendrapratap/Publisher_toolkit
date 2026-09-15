import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))

import { GET } from './route'
import { storeFile } from '@/lib/providers/storage'

const ctx = (segments: string[]) => ({ params: Promise.resolve({ path: segments }) })

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'pt-files-'))
  process.env.LOCAL_STORAGE_DIR = dir
  delete process.env.BLOB_READ_WRITE_TOKEN
})
afterEach(async () => {
  delete process.env.LOCAL_STORAGE_DIR
  await rm(dir, { recursive: true, force: true })
})

describe('GET /api/files/[...path]', () => {
  it("serves the caller's own file with its content type", async () => {
    await storeFile('ads/pub_1/cover.png', Buffer.from('png-bytes'), 'image/png')
    const res = await GET(new Request('http://localhost'), ctx(['ads', 'pub_1', 'cover.png']))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('png-bytes')
  })

  it("returns 404 for another publisher's file", async () => {
    await storeFile('ads/pub_2/cover.png', Buffer.from('secret'), 'image/png')
    const res = await GET(new Request('http://localhost'), ctx(['ads', 'pub_2', 'cover.png']))
    expect(res.status).toBe(404)
  })

  it('returns 404 for traversal and missing files', async () => {
    expect((await GET(new Request('http://localhost'), ctx(['ads', 'pub_1', '..', 'x']))).status).toBe(404)
    expect((await GET(new Request('http://localhost'), ctx(['ads', 'pub_1', 'nope.png']))).status).toBe(404)
  })
})
