import { describe, it, expect } from 'vitest'
import { buildAudiobookZip, audiobookZipFileName } from './zip'
import JSZip from 'jszip'

describe('buildAudiobookZip', () => {
  it('generates a ZIP archive containing playlist and tracklist metadata', async () => {
    const mockAudio = Buffer.from([0xff, 0xfb, 0x90, 0x64])
    const mockRead = async () => ({
      data: mockAudio,
      contentType: 'audio/mpeg',
    })

    const zipBuffer = await buildAudiobookZip(
      {
        title: 'Chronicles of Time',
        author: 'Julian Thorne',
        ttsProvider: 'fishaudio',
        voiceModel: 'warm-literary',
        audioFormat: 'mp3',
        chapters: [
          { chapterNumber: 1, title: 'The Beginning', audioUrl: 'mock://ch1.mp3', duration: 180 },
          { chapterNumber: 2, title: 'The Voyage', audioUrl: 'mock://ch2.mp3', duration: 240 },
        ],
      },
      mockRead as any
    )

    expect(zipBuffer).toBeInstanceOf(Buffer)
    expect(zipBuffer.length).toBeGreaterThan(0)

    const zip = await JSZip.loadAsync(zipBuffer)
    expect(zip.file('playlist.m3u')).not.toBeNull()
    expect(zip.file('tracklist.txt')).not.toBeNull()
    expect(zip.file('chapters/01-The Beginning.mp3')).not.toBeNull()

    const playlist = await zip.file('playlist.m3u')!.async('string')
    expect(playlist).toContain('#EXTM3U')
    expect(playlist).toContain('The Beginning')

    const tracklist = await zip.file('tracklist.txt')!.async('string')
    expect(tracklist).toContain('Chronicles of Time')
    expect(tracklist).toContain('Julian Thorne')
  })

  it('formats zip filename cleanly', () => {
    expect(audiobookZipFileName('My Great Story!')).toBe('my-great-story-complete-audiobook.zip')
  })
})
