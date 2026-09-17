import { describe, it, expect } from 'vitest'
import { renderTrailerVideoAndPoster } from './video'

describe('renderTrailerVideoAndPoster', () => {
  it('generates a video buffer and poster frame for 9:16 aspect ratio', async () => {
    const result = await renderTrailerVideoAndPoster({
      title: 'Echoes of Eternity',
      author: 'A. R. Sterling',
      blurb: 'A secret buried deep beneath the ruins of a lost civilization threatens everything.',
      length: '15s',
      style: 'cinematic',
      musicMood: 'suspenseful',
      aspectRatio: '9:16',
    })

    expect(result.aspectRatio).toBe('9:16')
    expect(result.width).toBe(1080)
    expect(result.height).toBe(1920)
    expect(result.durationSec).toBe(15)
    expect(result.posterBuffer).toBeInstanceOf(Buffer)
    expect(result.posterBuffer.length).toBeGreaterThan(1000)
    expect(result.videoBuffer).toBeInstanceOf(Buffer)
    expect(result.videoBuffer.length).toBeGreaterThan(0)
  }, 30000)
})
