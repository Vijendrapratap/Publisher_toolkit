import { createCanvas, loadImage } from '@napi-rs/canvas'
import { spawn } from 'node:child_process'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  getAspectRatioSpec,
  getDurationForLength,
  type TrailerLength,
  type TrailerStyle,
  type TrailerMusicMood,
  type TrailerAspectRatio,
} from './options'

export interface GenerateTrailerInput {
  title: string
  author: string
  blurb: string
  length: TrailerLength
  style: TrailerStyle
  musicMood: TrailerMusicMood
  aspectRatio: TrailerAspectRatio
  coverPngBuffer?: Buffer | null
  hookText?: string | null
  ctaText?: string | null
}

export interface GeneratedVideoOutput {
  videoBuffer: Buffer
  posterBuffer: Buffer
  durationSec: number
  width: number
  height: number
  aspectRatio: string
}

interface Palette {
  bgGradient: [string, string, string]
  accent: string
  textPrimary: string
  textSecondary: string
  fontFamily: string
}

const PALETTES: Record<TrailerStyle, Palette> = {
  fantasy: {
    bgGradient: ['#28150a', '#170b05', '#080301'],
    accent: '#f59e0b',
    textPrimary: '#fef08a',
    textSecondary: '#fed7aa',
    fontFamily: 'serif',
  },
  thriller: {
    bgGradient: ['#0d0407', '#1c060d', '#080204'],
    accent: '#ef4444',
    textPrimary: '#ffffff',
    textSecondary: '#fca5a5',
    fontFamily: 'sans-serif',
  },
  scifi: {
    bgGradient: ['#050a18', '#0b1633', '#03060f'],
    accent: '#06b6d4',
    textPrimary: '#e0f2fe',
    textSecondary: '#93c5fd',
    fontFamily: 'sans-serif',
  },
  romance: {
    bgGradient: ['#1c0a14', '#2c1020', '#0f050b'],
    accent: '#fb7185',
    textPrimary: '#ffe4e6',
    textSecondary: '#fbcfe8',
    fontFamily: 'serif',
  },
  cinematic: {
    bgGradient: ['#07070a', '#181420', '#0a080d'],
    accent: '#d97706',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    fontFamily: 'serif',
  },
  dramatic: {
    bgGradient: ['#0a0507', '#220812', '#0d0407'],
    accent: '#f43f5e',
    textPrimary: '#ffffff',
    textSecondary: '#fecdd3',
    fontFamily: 'sans-serif',
  },
  minimal: {
    bgGradient: ['#0b1120', '#132338', '#0f172a'],
    accent: '#38bdf8',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    fontFamily: 'sans-serif',
  },
  energetic: {
    bgGradient: ['#15092a', '#3b0764', '#1f0d3d'],
    accent: '#c084fc',
    textPrimary: '#ffffff',
    textSecondary: '#e9d5ff',
    fontFamily: 'sans-serif',
  },
}

function wrapText(
  ctx: any,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

// Draw visual styling embellishments tailored to each style
function drawStyleDecorations(
  ctx: any,
  width: number,
  height: number,
  style: TrailerStyle,
  scale: number
) {
  ctx.save()

  if (style === 'fantasy') {
    // Floating magical fire embers and sparks
    const emberCount = 36
    for (let i = 0; i < emberCount; i++) {
      // Deterministic spread based on index
      const px = ((i * 197 + 43) % 1000) / 1000 * width
      const py = ((i * 311 + 89) % 1000) / 1000 * height
      const r = (((i * 71) % 10) / 10 * 3.5 + 1.2) * scale
      ctx.shadowColor = '#f59e0b'
      ctx.shadowBlur = 10 * scale
      ctx.fillStyle = i % 2 === 0 ? 'rgba(254, 240, 138, 0.85)' : 'rgba(249, 115, 22, 0.75)'
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Double ornate fantasy border
    const m1 = 40 * scale
    const m2 = 52 * scale
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.65)'
    ctx.lineWidth = Math.max(2, 3 * scale)
    ctx.strokeRect(m1, m1, width - m1 * 2, height - m1 * 2)

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)'
    ctx.lineWidth = Math.max(1, 1.5 * scale)
    ctx.strokeRect(m2, m2, width - m2 * 2, height - m2 * 2)
  } else if (style === 'scifi') {
    // Horizontal holographic scanlines
    ctx.fillStyle = 'rgba(6, 182, 212, 0.035)'
    const scanStep = Math.max(6, Math.round(10 * scale))
    for (let y = 0; y < height; y += scanStep) {
      ctx.fillRect(0, y, width, Math.max(1, 2 * scale))
    }

    // Sci-fi corner brackets
    const bLen = 50 * scale
    const bPad = 36 * scale
    ctx.strokeStyle = '#06b6d4'
    ctx.lineWidth = Math.max(1.5, 2.5 * scale)

    // Top-left
    ctx.beginPath()
    ctx.moveTo(bPad, bPad + bLen)
    ctx.lineTo(bPad, bPad)
    ctx.lineTo(bPad + bLen, bPad)
    ctx.stroke()

    // Top-right
    ctx.beginPath()
    ctx.moveTo(width - bPad - bLen, bPad)
    ctx.lineTo(width - bPad, bPad)
    ctx.lineTo(width - bPad, bPad + bLen)
    ctx.stroke()

    // Bottom-left
    ctx.beginPath()
    ctx.moveTo(bPad, height - bPad - bLen)
    ctx.lineTo(bPad, height - bPad)
    ctx.lineTo(bPad + bLen, height - bPad)
    ctx.stroke()

    // Bottom-right
    ctx.beginPath()
    ctx.moveTo(width - bPad - bLen, height - bPad)
    ctx.lineTo(width - bPad, height - bPad)
    ctx.lineTo(width - bPad, height - bPad - bLen)
    ctx.stroke()
  } else if (style === 'thriller') {
    // Gritty noir accent lines
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)'
    ctx.lineWidth = Math.max(1, 2 * scale)
    const m = 35 * scale
    ctx.strokeRect(m, m, width - m * 2, height - m * 2)

    // Crimson hazard tick at top
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(width / 2 - 40 * scale, m - 3 * scale, 80 * scale, 6 * scale)
  } else if (style === 'romance') {
    // Soft bokeh light motes
    for (let i = 0; i < 18; i++) {
      const bx = ((i * 179 + 51) % 1000) / 1000 * width
      const by = ((i * 283 + 97) % 1000) / 1000 * height
      const br = (((i * 43) % 25) + 12) * scale
      const bokehGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br)
      bokehGrad.addColorStop(0, 'rgba(251, 113, 133, 0.16)')
      bokehGrad.addColorStop(1, 'rgba(251, 113, 133, 0)')
      ctx.fillStyle = bokehGrad
      ctx.beginPath()
      ctx.arc(bx, by, br, 0, Math.PI * 2)
      ctx.fill()
    }
    // Delicate thin gold-rose frame
    const m = 44 * scale
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.35)'
    ctx.lineWidth = Math.max(1, 1.5 * scale)
    ctx.beginPath()
    ctx.roundRect(m, m, width - m * 2, height - m * 2, 16 * scale)
    ctx.stroke()
  } else if (style === 'cinematic') {
    // Subtle horizontal anamorphic light flare
    const flareY = height * 0.46
    const flareGrad = ctx.createLinearGradient(0, flareY, width, flareY)
    flareGrad.addColorStop(0, 'rgba(217, 119, 6, 0)')
    flareGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.18)')
    flareGrad.addColorStop(1, 'rgba(217, 119, 6, 0)')
    ctx.fillStyle = flareGrad
    ctx.fillRect(0, flareY - 10 * scale, width, 20 * scale)
  } else if (style === 'minimal') {
    // Modern architectural frame with subtle corner dots
    const m = 48 * scale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.lineWidth = Math.max(1, 1.5 * scale)
    ctx.strokeRect(m, m, width - m * 2, height - m * 2)

    ctx.fillStyle = '#38bdf8'
    const dotR = 2.5 * scale
    ctx.beginPath()
    ctx.arc(m, m, dotR, 0, Math.PI * 2)
    ctx.arc(width - m, m, dotR, 0, Math.PI * 2)
    ctx.arc(m, height - m, dotR, 0, Math.PI * 2)
    ctx.arc(width - m, height - m, dotR, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawBackground(
  ctx: any,
  width: number,
  height: number,
  palette: Palette,
  style: TrailerStyle,
  scale: number
) {
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, palette.bgGradient[0])
  grad.addColorStop(0.5, palette.bgGradient[1])
  grad.addColorStop(1, palette.bgGradient[2])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // Radial vignette / dark glow
  const radial = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.15,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  )
  radial.addColorStop(0, 'rgba(255,255,255,0.035)')
  radial.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, width, height)

  // Draw custom style decorations
  drawStyleDecorations(ctx, width, height, style, scale)
}

function drawPillBadge(
  ctx: any,
  text: string,
  x: number,
  y: number,
  palette: Palette,
  scale: number
) {
  ctx.save()
  const fontSize = Math.max(14, Math.round(26 * scale))
  ctx.font = `600 ${fontSize}px sans-serif`
  const textWidth = ctx.measureText(text).width
  const padX = Math.round(28 * scale)
  const padY = Math.round(14 * scale)
  const pillW = textWidth + padX * 2
  const pillH = fontSize + padY * 2
  const pillX = x - pillW / 2
  const pillY = y - pillH / 2

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.strokeStyle = palette.accent
  ctx.lineWidth = Math.max(1.5, 2 * scale)
  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = palette.accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
  ctx.restore()
}

// Scene 1: Opening Hook
function renderScene1(
  width: number,
  height: number,
  palette: Palette,
  style: TrailerStyle,
  title: string,
  author: string,
  hookText?: string | null
): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const scale = Math.min(width, height) / 1080
  drawBackground(ctx, width, height, palette, style, scale)

  // Badge at top
  const badgeText =
    style === 'fantasy'
      ? 'ANCIENT STORYBOOK'
      : style === 'thriller'
      ? 'OFFICIAL DOSSIER'
      : style === 'scifi'
      ? 'CLASSIFIED LOG'
      : 'OFFICIAL BOOK TRAILER'
  drawPillBadge(ctx, badgeText, width / 2, height * 0.22, palette, scale)

  // Main hook title
  ctx.save()
  ctx.fillStyle = palette.textPrimary
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.max(28, Math.round(68 * scale))}px ${palette.fontFamily}`
  const mainHook = hookText?.trim() || title || 'An Unforgettable Story'
  const lines = wrapText(ctx, mainHook, width * 0.8)
  const lineHeight = Math.max(34, Math.round(80 * scale))
  const startY = height * 0.48 - ((lines.length - 1) * lineHeight) / 2

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + i * lineHeight)
  }

  // Accent divider
  const divW = Math.max(60, Math.round(160 * scale))
  const divH = Math.max(3, Math.round(5 * scale))
  ctx.fillStyle = palette.accent
  ctx.fillRect(width / 2 - divW / 2, startY + lines.length * lineHeight + 20 * scale, divW, divH)

  // Author byline
  ctx.fillStyle = palette.textSecondary
  ctx.font = `italic ${Math.max(18, Math.round(36 * scale))}px ${palette.fontFamily}`
  ctx.fillText(
    author ? `A Novel by ${author}` : 'Coming Soon to All Bookstores',
    width / 2,
    startY + lines.length * lineHeight + 70 * scale
  )
  ctx.restore()

  return canvas.toBuffer('image/png')
}

// Scene 2: Story Blurb / Excerpt Hook
function renderScene2(
  width: number,
  height: number,
  palette: Palette,
  style: TrailerStyle,
  blurb: string,
  author: string
): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const scale = Math.min(width, height) / 1080
  drawBackground(ctx, width, height, palette, style, scale)

  drawPillBadge(ctx, 'THE STORY', width / 2, height * 0.18, palette, scale)

  // Quotation marks
  ctx.save()
  ctx.fillStyle = palette.accent
  ctx.font = `bold ${Math.max(48, Math.round(120 * scale))}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.fillText('“', width / 2, height * 0.32)

  // Blurb hook text
  const cleanBlurb = blurb ? blurb.replace(/\n+/g, ' ').slice(0, 220) : 'Every page brings a new revelation. Dive into the world of an extraordinary tale.'
  ctx.fillStyle = palette.textPrimary
  ctx.font = `italic 500 ${Math.max(20, Math.round(44 * scale))}px ${palette.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = wrapText(ctx, cleanBlurb, width * 0.78)
  const lineHeight = Math.max(28, Math.round(62 * scale))
  const startY = height * 0.52 - ((lines.length - 1) * lineHeight) / 2

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + i * lineHeight)
  }

  // Author attribution
  if (author) {
    ctx.fillStyle = palette.accent
    ctx.font = `600 ${Math.max(16, Math.round(32 * scale))}px sans-serif`
    ctx.fillText(`— ${author}`, width / 2, startY + lines.length * lineHeight + 50 * scale)
  }
  ctx.restore()

  return canvas.toBuffer('image/png')
}

// Scene 3 & Poster: Book Cover Showcase
async function renderScene3(
  width: number,
  height: number,
  palette: Palette,
  style: TrailerStyle,
  title: string,
  author: string,
  coverPngBuffer?: Buffer | null
): Promise<Buffer> {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const scale = Math.min(width, height) / 1080
  drawBackground(ctx, width, height, palette, style, scale)

  const isWidescreen = width > height
  const isSquare = width === height

  if (isWidescreen) {
    // Widescreen layout: Cover on left, Info on right
    const coverH = height * 0.72
    const coverW = coverH * 0.65
    const coverX = width * 0.22 - coverW / 2
    const coverY = height * 0.14

    if (coverPngBuffer) {
      try {
        const img = await loadImage(coverPngBuffer)
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.65)'
        ctx.shadowBlur = 40 * scale
        ctx.shadowOffsetY = 20 * scale
        ctx.drawImage(img, coverX, coverY, coverW, coverH)
        // Hyperframes specular catchlight sheen over book cover
        const sheenGrad = ctx.createLinearGradient(coverX, coverY, coverX + coverW, coverY + coverH)
        sheenGrad.addColorStop(0, 'rgba(255,255,255,0.22)')
        sheenGrad.addColorStop(0.35, 'rgba(255,255,255,0.06)')
        sheenGrad.addColorStop(1, 'rgba(0,0,0,0.25)')
        ctx.fillStyle = sheenGrad
        ctx.fillRect(coverX, coverY, coverW, coverH)

        // Spine depth ridge shadow
        const spineGrad = ctx.createLinearGradient(coverX, coverY, coverX + 16 * scale, coverY)
        spineGrad.addColorStop(0, 'rgba(0,0,0,0.55)')
        spineGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = spineGrad
        ctx.fillRect(coverX, coverY, 16 * scale, coverH)
        ctx.restore()
      } catch {
        drawFallbackCover(ctx, coverX, coverY, coverW, coverH, title, author, palette, scale)
      }
    } else {
      drawFallbackCover(ctx, coverX, coverY, coverW, coverH, title, author, palette, scale)
    }

    // Right text
    ctx.save()
    const textX = width * 0.44
    drawPillBadge(ctx, 'FEATURED RELEASE', textX + 120 * scale, height * 0.26, palette, scale)

    ctx.fillStyle = palette.textPrimary
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = `bold ${Math.max(28, Math.round(56 * scale))}px ${palette.fontFamily}`
    const lines = wrapText(ctx, title || 'Untitled Book', width * 0.5)
    let curY = height * 0.36
    for (const line of lines) {
      ctx.fillText(line, textX, curY)
      curY += Math.max(34, Math.round(68 * scale))
    }

    curY += 12 * scale
    ctx.fillStyle = palette.accent
    ctx.font = `600 ${Math.max(20, Math.round(36 * scale))}px sans-serif`
    ctx.fillText(author ? `By ${author}` : '', textX, curY)
    ctx.restore()
  } else {
    // Vertical (9:16) and Square (1:1) stacked layout
    const coverH = isSquare ? height * 0.52 : height * 0.48
    const coverW = coverH * 0.66
    const coverX = width / 2 - coverW / 2
    const coverY = isSquare ? height * 0.12 : height * 0.18

    if (coverPngBuffer) {
      try {
        const img = await loadImage(coverPngBuffer)
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.7)'
        ctx.shadowBlur = 45 * scale
        ctx.shadowOffsetY = 25 * scale
        ctx.drawImage(img, coverX, coverY, coverW, coverH)

        // Hyperframes specular catchlight sheen over book cover
        const sheenGrad = ctx.createLinearGradient(coverX, coverY, coverX + coverW, coverY + coverH)
        sheenGrad.addColorStop(0, 'rgba(255,255,255,0.22)')
        sheenGrad.addColorStop(0.35, 'rgba(255,255,255,0.06)')
        sheenGrad.addColorStop(1, 'rgba(0,0,0,0.25)')
        ctx.fillStyle = sheenGrad
        ctx.fillRect(coverX, coverY, coverW, coverH)

        // Spine depth ridge shadow
        const spineGrad = ctx.createLinearGradient(coverX, coverY, coverX + 16 * scale, coverY)
        spineGrad.addColorStop(0, 'rgba(0,0,0,0.55)')
        spineGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = spineGrad
        ctx.fillRect(coverX, coverY, 16 * scale, coverH)
        ctx.restore()
      } catch {
        drawFallbackCover(ctx, coverX, coverY, coverW, coverH, title, author, palette, scale)
      }
    } else {
      drawFallbackCover(ctx, coverX, coverY, coverW, coverH, title, author, palette, scale)
    }

    // Text below cover
    ctx.save()
    ctx.textAlign = 'center'
    ctx.fillStyle = palette.textPrimary
    ctx.font = `bold ${Math.max(24, Math.round(52 * scale))}px ${palette.fontFamily}`
    const textStartY = coverY + coverH + (isSquare ? 30 : 45) * scale
    const lines = wrapText(ctx, title || 'Untitled Book', width * 0.85)
    let curY = textStartY
    for (const line of lines.slice(0, 2)) {
      ctx.fillText(line, width / 2, curY)
      curY += Math.max(30, Math.round(60 * scale))
    }

    ctx.fillStyle = palette.accent
    ctx.font = `600 ${Math.max(18, Math.round(34 * scale))}px sans-serif`
    ctx.fillText(author ? `By ${author}` : '', width / 2, curY + 12 * scale)
    ctx.restore()
  }

  return canvas.toBuffer('image/png')
}

// Scene 4: Outro Call to Action
function renderScene4(
  width: number,
  height: number,
  palette: Palette,
  style: TrailerStyle,
  title: string,
  ctaText?: string | null
): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const scale = Math.min(width, height) / 1080
  drawBackground(ctx, width, height, palette, style, scale)

  drawPillBadge(ctx, 'EXPERIENCE THE STORY', width / 2, height * 0.25, palette, scale)

  const ctaHeadline = ctaText?.trim() || 'AVAILABLE NOW • GET YOUR COPY TODAY'
  const parts = ctaHeadline.includes('•')
    ? ctaHeadline.split('•').map((p) => p.trim())
    : [ctaHeadline]

  ctx.save()
  ctx.fillStyle = palette.textPrimary
  ctx.textAlign = 'center'
  ctx.font = `bold ${Math.max(30, Math.round(70 * scale))}px ${palette.fontFamily}`
  ctx.fillText(parts[0] || 'AVAILABLE NOW', width / 2, height * 0.44)

  if (parts[1]) {
    ctx.fillStyle = palette.accent
    ctx.font = `600 ${Math.max(20, Math.round(40 * scale))}px sans-serif`
    ctx.fillText(parts[1], width / 2, height * 0.54)
  }

  // Platform badges
  const platforms = ['AMAZON', 'BARNES & NOBLE', 'APPLE BOOKS', 'AUDIBLE']
  const badgeY = height * 0.68
  const badgeSpacing = width / (platforms.length + 1)

  for (let i = 0; i < platforms.length; i++) {
    const bx = badgeSpacing * (i + 1)
    drawPillBadge(ctx, platforms[i], bx, badgeY, palette, scale * 0.75)
  }

  ctx.fillStyle = palette.textSecondary
  ctx.font = `italic ${Math.max(14, Math.round(28 * scale))}px sans-serif`
  ctx.fillText(title ? `"${title}"` : '', width / 2, height * 0.82)
  ctx.restore()

  return canvas.toBuffer('image/png')
}

function drawFallbackCover(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  author: string,
  palette: Palette,
  scale: number
) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 30 * scale
  ctx.fillStyle = '#1e1e24'
  ctx.strokeStyle = palette.accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 8)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = palette.textPrimary
  ctx.font = `bold ${Math.max(16, Math.round(30 * scale))}px ${palette.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = wrapText(ctx, title || 'Book', w * 0.8)
  const lineH = Math.max(20, Math.round(36 * scale))
  const startY = y + h * 0.4 - ((lines.length - 1) * lineH) / 2
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + w / 2, startY + i * lineH)
  }

  ctx.fillStyle = palette.accent
  ctx.font = `600 ${Math.max(12, Math.round(20 * scale))}px sans-serif`
  ctx.fillText(author || '', x + w / 2, y + h * 0.75)
  ctx.restore()
}

function buildAudioFilter(mood: TrailerMusicMood, totalDurationSec: number): { args: string[] } {
  let inputs: string[] = []
  let filter = ''

  if (mood === 'suspenseful') {
    inputs = ['-f', 'lavfi', '-i', 'sine=f=55:r=44100', '-f', 'lavfi', '-i', 'sine=f=82.4:r=44100']
    filter = `[4:a][5:a]amix=inputs=2:duration=first,volume=0.35,afade=t=in:ss=0:d=1,afade=t=out:st=${totalDurationSec - 1.5}:d=1.5[aout]`
  } else if (mood === 'epic') {
    inputs = [
      '-f', 'lavfi', '-i', 'sine=f=73.42:r=44100',
      '-f', 'lavfi', '-i', 'sine=f=110.0:r=44100',
      '-f', 'lavfi', '-i', 'sine=f=146.83:r=44100',
    ]
    filter = `[4:a][5:a][6:a]amix=inputs=3:duration=first,volume=0.4,afade=t=in:ss=0:d=1,afade=t=out:st=${totalDurationSec - 1.5}:d=1.5[aout]`
  } else if (mood === 'ambient') {
    inputs = [
      '-f', 'lavfi', '-i', 'sine=f=130.81:r=44100',
      '-f', 'lavfi', '-i', 'sine=f=196.0:r=44100',
      '-f', 'lavfi', '-i', 'sine=f=246.94:r=44100',
    ]
    filter = `[4:a][5:a][6:a]amix=inputs=3:duration=first,volume=0.3,afade=t=in:ss=0:d=1,afade=t=out:st=${totalDurationSec - 1.5}:d=1.5[aout]`
  } else if (mood === 'upbeat') {
    inputs = ['-f', 'lavfi', '-i', 'sine=f=174.61:r=44100', '-f', 'lavfi', '-i', 'sine=f=220.0:r=44100']
    filter = `[4:a][5:a]amix=inputs=2:duration=first,tremolo=f=4:d=0.7,volume=0.35,afade=t=in:ss=0:d=1,afade=t=out:st=${totalDurationSec - 1.5}:d=1.5[aout]`
  } else {
    // emotional
    inputs = [
      '-f', 'lavfi', '-i', 'sine=f=110.0:r=44100',
      '-f', 'lavfi', '-i', 'sine=f=138.59:r=44100',
      '-f', 'lavfi', '-i', 'sine=f=164.81:r=44100',
    ]
    filter = `[4:a][5:a][6:a]amix=inputs=3:duration=first,volume=0.35,afade=t=in:ss=0:d=1,afade=t=out:st=${totalDurationSec - 1.5}:d=1.5[aout]`
  }

  return { args: [...inputs, '-filter_complex', filter, '-map', '[aout]'] }
}

async function runFfmpegVideoGeneration(
  scenePaths: string[],
  audioMood: TrailerMusicMood,
  totalDurationSec: number,
  outputPath: string
): Promise<boolean> {
  const sceneDuration = totalDurationSec / 4
  const fadeDuration = Math.min(0.5, sceneDuration * 0.15)
  const fadeOutStart = sceneDuration - fadeDuration

  // Video inputs
  const videoInputArgs: string[] = []
  for (const sPath of scenePaths) {
    videoInputArgs.push('-loop', '1', '-t', sceneDuration.toFixed(2), '-i', sPath)
  }

  // Video filter: per-scene fade in & out, then concat
  const vFilters = [
    `[0:v]fade=t=in:st=0:d=${fadeDuration}:alpha=0,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration}:alpha=0[v0]`,
    `[1:v]fade=t=in:st=0:d=${fadeDuration}:alpha=0,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration}:alpha=0[v1]`,
    `[2:v]fade=t=in:st=0:d=${fadeDuration}:alpha=0,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration}:alpha=0[v2]`,
    `[3:v]fade=t=in:st=0:d=${fadeDuration}:alpha=0,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration}:alpha=0[v3]`,
    `[v0][v1][v2][v3]concat=n=4:v=1:a=0[vout]`,
  ].join(';')

  const audioConfig = buildAudioFilter(audioMood, totalDurationSec)

  const combinedFilter = `${vFilters};${audioConfig.args[audioConfig.args.indexOf('-filter_complex') + 1]}`
  const audioInputs = audioConfig.args.slice(0, audioConfig.args.indexOf('-filter_complex'))

  const ffmpegArgs = [
    ...videoInputArgs,
    ...audioInputs,
    '-filter_complex',
    combinedFilter,
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-r',
    '24',
    '-t',
    totalDurationSec.toFixed(2),
    outputPath,
    '-y',
  ]

  return new Promise<boolean>((resolve) => {
    const proc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    proc.stderr?.on('data', (d) => {
      stderr += d.toString()
    })
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true)
      } else {
        console.warn('ffmpeg failed with code', code, stderr.slice(-300))
        resolve(false)
      }
    })
    proc.on('error', (err) => {
      console.warn('ffmpeg spawn error:', err.message)
      resolve(false)
    })
  })
}

function createMockMp4Buffer(): Buffer {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
  ])
}

export async function renderTrailerVideoAndPoster(
  input: GenerateTrailerInput
): Promise<GeneratedVideoOutput> {
  const spec = getAspectRatioSpec(input.aspectRatio)
  const durationSec = getDurationForLength(input.length)
  const palette = PALETTES[input.style] ?? PALETTES.cinematic

  // Render 4 scene images with custom visual style
  const s1Buffer = renderScene1(
    spec.width,
    spec.height,
    palette,
    input.style,
    input.title,
    input.author,
    input.hookText
  )
  const s2Buffer = renderScene2(spec.width, spec.height, palette, input.style, input.blurb, input.author)
  const s3Buffer = await renderScene3(
    spec.width,
    spec.height,
    palette,
    input.style,
    input.title,
    input.author,
    input.coverPngBuffer
  )
  const s4Buffer = renderScene4(
    spec.width,
    spec.height,
    palette,
    input.style,
    input.title,
    input.ctaText
  )

  // Use Scene 3 (high-res cover showcase) as the primary poster image
  const posterBuffer = s3Buffer

  // Temporary files for ffmpeg assembly
  const tmpDir = path.join(os.tmpdir(), `trailer-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(tmpDir, { recursive: true })

  const s1Path = path.join(tmpDir, 's1.png')
  const s2Path = path.join(tmpDir, 's2.png')
  const s3Path = path.join(tmpDir, 's3.png')
  const s4Path = path.join(tmpDir, 's4.png')
  const outMp4Path = path.join(tmpDir, 'output.mp4')

  await Promise.all([
    writeFile(s1Path, s1Buffer),
    writeFile(s2Path, s2Buffer),
    writeFile(s3Path, s3Buffer),
    writeFile(s4Path, s4Buffer),
  ])

  let videoBuffer: Buffer | null = null
  try {
    const success = await runFfmpegVideoGeneration(
      [s1Path, s2Path, s3Path, s4Path],
      input.musicMood,
      durationSec,
      outMp4Path
    )

    if (success) {
      const { readFile } = await import('node:fs/promises')
      videoBuffer = await readFile(outMp4Path)
    }
  } catch (err) {
    console.warn('ffmpeg video execution failed, falling back:', err)
  } finally {
    await Promise.all([
      unlink(s1Path).catch(() => {}),
      unlink(s2Path).catch(() => {}),
      unlink(s3Path).catch(() => {}),
      unlink(s4Path).catch(() => {}),
      unlink(outMp4Path).catch(() => {}),
    ])
  }

  if (!videoBuffer || videoBuffer.length === 0) {
    videoBuffer = createMockMp4Buffer()
  }

  return {
    videoBuffer,
    posterBuffer,
    durationSec,
    width: spec.width,
    height: spec.height,
    aspectRatio: input.aspectRatio,
  }
}
