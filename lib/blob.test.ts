import { describe, it, expect, afterEach } from 'vitest'
import { uploadToBlob } from './blob'

describe('uploadToBlob', () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN

  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = originalToken
  })

  it('returns a data: URI when no Blob token is configured', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN

    const result = await uploadToBlob('books/pub_1/test.png', Buffer.from('png-bytes'), 'image/png')

    expect(result.url).toBe(`data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`)
  })
})
