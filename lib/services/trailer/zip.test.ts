import { describe, it, expect, vi } from 'vitest'
import JSZip from 'jszip'
import { buildTrailerZip, zipFileName } from './zip'

describe('trailer zip', () => {
  it('generates a clean slugged zip filename', () => {
    expect(zipFileName('The Silent Horizon: A Space Odyssey')).toBe(
      'the-silent-horizon-a-space-odyssey-trailer-videos.zip'
    )
    expect(zipFileName('')).toBe('book-trailer-videos.zip')
  })

  it('assembles trailers, posters, and details text into a zip buffer', async () => {
    const mockRead = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('.mp4')) {
        return { data: Buffer.from('mock-mp4-video'), contentType: 'video/mp4' }
      }
      return { data: Buffer.from('mock-png-poster'), contentType: 'image/png' }
    })

    const zipBuffer = await buildTrailerZip(
      {
        title: 'Starfall',
        author: 'John Doe',
        blurb: 'An epic galactic saga.',
        length: '30s',
        style: 'cinematic',
        musicMood: 'epic',
        trailers: [
          {
            aspectRatio: '9:16',
            videoUrl: 'https://example.com/trailer-9x16.mp4',
            posterUrl: 'https://example.com/poster-9x16.png',
          },
          {
            aspectRatio: '16:9',
            videoUrl: 'https://example.com/trailer-16x9.mp4',
            posterUrl: 'https://example.com/poster-16x9.png',
          },
        ],
      },
      mockRead as any
    )

    expect(zipBuffer).toBeInstanceOf(Buffer)
    expect(zipBuffer.length).toBeGreaterThan(0)

    const zip = await JSZip.loadAsync(zipBuffer)
    expect(zip.file('trailers/trailer-9x16.mp4')).not.toBeNull()
    expect(zip.file('trailers/trailer-16x9.mp4')).not.toBeNull()
    expect(zip.file('posters/poster-9x16.png')).not.toBeNull()
    expect(zip.file('posters/poster-16x9.png')).not.toBeNull()

    const detailsFile = zip.file('trailer-details.txt')
    expect(detailsFile).not.toBeNull()
    const content = await detailsFile!.async('string')
    expect(content).toContain('Starfall')
    expect(content).toContain('John Doe')
    expect(content).toContain('epic')
  })
})
