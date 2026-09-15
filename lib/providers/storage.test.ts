import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { storeFile, readStoredFile, toDataUri } from './storage'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'pt-storage-'))
  process.env.LOCAL_STORAGE_DIR = dir
  delete process.env.BLOB_READ_WRITE_TOKEN
})
afterEach(async () => {
  delete process.env.LOCAL_STORAGE_DIR
  await rm(dir, { recursive: true, force: true })
})

describe('local storage', () => {
  it('stores a file and returns a served URL', async () => {
    const { url } = await storeFile('ads/pub_1/cover.png', Buffer.from('png-bytes'), 'image/png')
    expect(url).toBe('/api/files/ads/pub_1/cover.png')
  })

  it('reads back what it stored with the right content type', async () => {
    const { url } = await storeFile('ads/pub_1/book.pdf', Buffer.from('%PDF'), 'application/pdf')
    const file = await readStoredFile(url)
    expect(file.data.toString()).toBe('%PDF')
    expect(file.contentType).toBe('application/pdf')
  })

  it('rejects path traversal', async () => {
    await expect(storeFile('ads/../../etc/passwd', Buffer.from('x'), 'text/plain')).rejects.toThrow('invalid path')
  })

  it('reads data URIs and converts files to data URIs', async () => {
    const uri = toDataUri({ data: Buffer.from('hi'), contentType: 'image/png' })
    expect(uri).toBe('data:image/png;base64,aGk=')
    const file = await readStoredFile(uri)
    expect(file.data.toString()).toBe('hi')
    expect(file.contentType).toBe('image/png')
  })
})
