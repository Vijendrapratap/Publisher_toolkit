import { describe, it, expect } from 'vitest'
import { parseManuscriptChapters } from './chapterParser'

describe('parseManuscriptChapters', () => {
  it('parses standard chapter headings', () => {
    const text = `
Chapter 1: The Beginning
It was a dark and stormy night in the valley.

Chapter 2: The Journey
They set out across the open plains before dawn.

Chapter 3
The fortress appeared on the horizon.
`
    const chapters = parseManuscriptChapters(text)
    expect(chapters.length).toBe(3)
    expect(chapters[0].title).toBe('Chapter 1: The Beginning')
    expect(chapters[0].content).toContain('dark and stormy night')
    expect(chapters[1].title).toBe('Chapter 2: The Journey')
    expect(chapters[2].title).toBe('Chapter 3')
  })

  it('detects prologue and epilogue', () => {
    const text = `
PROLOGUE
Before the world was made, the shadows ruled.

CHAPTER 1: AWAKENING
She opened her eyes to the crimson sunrise.

EPILOGUE
Ten years later, the bells rang once more.
`
    const chapters = parseManuscriptChapters(text)
    expect(chapters.length).toBe(3)
    expect(chapters[0].title).toBe('PROLOGUE')
    expect(chapters[1].title).toBe('CHAPTER 1: AWAKENING')
    expect(chapters[2].title).toBe('EPILOGUE')
  })

  it('handles empty input gracefully', () => {
    const chapters = parseManuscriptChapters('')
    expect(chapters.length).toBe(1)
    expect(chapters[0].chapterNumber).toBe(1)
  })
})
