import type { SKRSContext2D, Image } from '@napi-rs/canvas'
import type { AdPreset, Palette } from './presets'
import {
  beatOpacity,
  easeOut,
  fitSingleLine,
  fitText,
  safeFontWeight,
  stagger,
  wrapLines,
  type TypeRamp,
} from './layout'

export const AD_FONT = 'AdSans'

export interface SceneAssets {
  cover: Image | null
  interiors: Image[]
  scene: Image | null
}

export interface SceneInput {
  ctx: SKRSContext2D
  width: number
  height: number
  ramp: TypeRamp
  preset: AdPreset
  assets: SceneAssets
  title: string
  author: string
  headline: string
  benefits: string[]
  ctaText: string
  rating: number | null
  reviewCount: number | null
  price: string | null
  /** 0–1 within the current beat. */
  progress: number
  /** 0–1 across the whole ad, for continuous background motion. */
  globalProgress: number
}

function font(weight: number, size: number): string {
  return `${safeFontWeight(weight)} ${Math.round(size)}px ${AD_FONT}`
}

/**
 * Background wash, or the AI scene when one was generated. Either way it pans
 * slowly across the whole ad so the frame is never completely static.
 */
export function drawBackground(input: SceneInput): void {
  const { ctx, width, height, preset, assets, globalProgress } = input
  const { palette } = preset

  if (assets.scene) {
    // Ken Burns: a 6% push-in over the full duration reads as intentional
    // camera movement without ever revealing an edge.
    const zoom = 1.06 + 0.06 * globalProgress
    const w = width * zoom
    const h = height * zoom
    ctx.drawImage(assets.scene, (width - w) / 2, (height - h) / 2, w, h)

    // Hold contrast for the text regardless of what the model produced.
    const scrim = ctx.createLinearGradient(0, 0, width, 0)
    scrim.addColorStop(0, 'rgba(255,255,255,0.90)')
    scrim.addColorStop(0.55, 'rgba(255,255,255,0.55)')
    scrim.addColorStop(1, 'rgba(255,255,255,0.15)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, width, height)
    return
  }

  const drift = Math.sin(globalProgress * Math.PI) * height * 0.04
  const wash = ctx.createLinearGradient(0, -drift, width, height + drift)
  wash.addColorStop(0, palette.background[0])
  wash.addColorStop(1, palette.background[1])
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)
  drawConfetti(ctx, width, height, palette, globalProgress)
}

/** Sparse drifting shapes: texture without noise, and cheap to draw per frame. */
function drawConfetti(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  palette: Palette,
  t: number
): void {
  ctx.save()
  ctx.globalAlpha = 0.16
  const unit = Math.min(width, height)
  for (let i = 0; i < 22; i++) {
    // Deterministic pseudo-random placement — the same ad renders identically.
    const seedX = ((i * 73) % 100) / 100
    const seedY = ((i * 149) % 100) / 100
    const size = unit * (0.012 + ((i * 37) % 20) / 1000)
    const x = seedX * width
    const y = ((seedY + t * 0.12) % 1) * height

    ctx.fillStyle = i % 3 === 0 ? palette.accent : palette.inkMuted
    ctx.beginPath()
    if (i % 2 === 0) ctx.arc(x, y, size / 2, 0, Math.PI * 2)
    else ctx.roundRect(x, y, size, size * 0.6, size * 0.2)
    ctx.fill()
  }
  ctx.restore()
}

/** Book cover with a real drop shadow and a slight page edge. */
export function drawCover(
  ctx: SKRSContext2D,
  cover: Image | null,
  box: { x: number; y: number; width: number; height: number },
  palette: Palette,
  title: string
): void {
  const ratio = cover ? cover.width / cover.height : 0.66
  let w = box.width
  let h = w / ratio
  if (h > box.height) {
    h = box.height
    w = h * ratio
  }
  const x = box.x + (box.width - w) / 2
  const y = box.y + (box.height - h) / 2

  ctx.save()
  ctx.shadowColor = 'rgba(15, 10, 40, 0.34)'
  ctx.shadowBlur = w * 0.12
  ctx.shadowOffsetY = w * 0.045

  if (cover) {
    ctx.drawImage(cover, x, y, w, h)
  } else {
    ctx.fillStyle = palette.panel
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, w * 0.02)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = palette.ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = w * 0.1
    ctx.font = font(800, size)
    const lines = wrapLines(title.toUpperCase(), w * 0.8, (s) => ctx.measureText(s).width)
    lines.slice(0, 4).forEach((line, i) => {
      ctx.fillText(line, x + w / 2, y + h / 2 + (i - (Math.min(lines.length, 4) - 1) / 2) * size * 1.2)
    })
  }
  ctx.restore()

  // Spine highlight: reads as a physical book rather than a flat JPEG.
  ctx.save()
  const spine = ctx.createLinearGradient(x, 0, x + w * 0.06, 0)
  spine.addColorStop(0, 'rgba(0,0,0,0.20)')
  spine.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = spine
  ctx.fillRect(x, y, w * 0.06, h)
  ctx.restore()
}

/** All-caps headline block, lines rising into place in sequence. */
function drawHeadlineBlock(
  input: SceneInput,
  box: { x: number; y: number; width: number; height: number },
  text: string,
  reveal: number
): void {
  const { ctx, ramp, preset } = input
  const { size, lines } = fitText(
    text.toUpperCase(),
    box,
    ramp.headline,
    ramp.headline * 0.55,
    (s, str) => {
      ctx.font = font(preset.headlineWeight, s)
      return ctx.measureText(str).width
    },
    ramp.lineHeight
  )

  ctx.save()
  ctx.font = font(preset.headlineWeight, size)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = preset.palette.ink

  const offsets = stagger(reveal, lines.length, 0.55)
  lines.forEach((line, i) => {
    const appear = offsets[i]
    ctx.globalAlpha = Math.min(1, Math.max(0, appear))
    ctx.fillText(line, box.x, box.y + i * size * ramp.lineHeight + (1 - appear) * size * 0.35)
  })
  ctx.restore()
}

function drawEyebrow(input: SceneInput, x: number, y: number, text: string): void {
  const { ctx, ramp, preset } = input
  ctx.save()
  ctx.font = font(700, ramp.label)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const padX = ramp.label * 0.7
  const padY = ramp.label * 0.42
  const w = ctx.measureText(text).width + padX * 2
  const h = ramp.label + padY * 2

  ctx.fillStyle = preset.palette.accent
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.fill()

  ctx.fillStyle = preset.palette.onAccent
  ctx.fillText(text, x + padX, y + padY)
  ctx.restore()
}

/** Split layout: text on the left, cover on the right — the reference shape. */
export function drawHook(input: SceneInput): void {
  const { ctx, width, height, preset, assets, headline, progress } = input
  const pad = width * 0.06
  const isVertical = height > width * 1.2

  ctx.globalAlpha = beatOpacity(progress)

  if (isVertical) {
    drawCover(
      ctx,
      assets.cover,
      { x: pad, y: height * 0.08, width: width - pad * 2, height: height * 0.42 },
      preset.palette,
      input.title
    )
    drawHeadlineBlock(
      input,
      { x: pad, y: height * 0.58, width: width - pad * 2, height: height * 0.3 },
      headline,
      progress
    )
  } else {
    const textWidth = width * 0.5 - pad
    drawEyebrow(input, pad, height * 0.13, preset.label.toUpperCase())
    drawHeadlineBlock(
      input,
      { x: pad, y: height * 0.24, width: textWidth, height: height * 0.52 },
      headline,
      progress
    )
    // The cover slides in from the right and settles.
    const slide = (1 - easeOut(progress)) * width * 0.08
    drawCover(
      ctx,
      assets.cover,
      { x: width * 0.53 + slide, y: height * 0.1, width: width * 0.4, height: height * 0.8 },
      preset.palette,
      input.title
    )
  }
  ctx.globalAlpha = 1
}

/** Benefit lines revealed one at a time against a panel. */
export function drawBenefits(input: SceneInput): void {
  const { ctx, width, height, preset, benefits, progress, ramp, assets } = input
  const pad = width * 0.07
  const lines = benefits.slice(0, 4)
  ctx.globalAlpha = beatOpacity(progress)

  const isVertical = height > width * 1.2
  const panelWidth = isVertical ? width - pad * 2 : width * 0.56
  const panelX = pad
  const panelHeight = Math.min(height * 0.72, lines.length * ramp.benefit * 2.1 + ramp.benefit * 2)
  const panelY = (height - panelHeight) / 2

  ctx.save()
  ctx.fillStyle = preset.palette.panel
  ctx.globalAlpha *= 0.94
  ctx.shadowColor = 'rgba(15,10,40,0.16)'
  ctx.shadowBlur = width * 0.03
  ctx.beginPath()
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, width * 0.03)
  ctx.fill()
  ctx.restore()

  if (!isVertical) {
    drawCover(
      ctx,
      assets.cover,
      { x: width * 0.63, y: height * 0.16, width: width * 0.3, height: height * 0.68 },
      preset.palette,
      input.title
    )
  }

  const reveals = stagger(progress, lines.length)
  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    const appear = Math.min(1, Math.max(0, reveals[i]))
    const y = panelY + ramp.benefit * 1.4 + i * ramp.benefit * 2.1
    ctx.globalAlpha = appear

    // Accent tick, then the claim.
    const tickX = panelX + ramp.benefit * 0.9
    ctx.strokeStyle = preset.palette.accent
    ctx.lineWidth = ramp.benefit * 0.16
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(tickX - ramp.benefit * 0.26, y)
    ctx.lineTo(tickX - ramp.benefit * 0.06, y + ramp.benefit * 0.24)
    ctx.lineTo(tickX + ramp.benefit * 0.3, y - ramp.benefit * 0.28)
    ctx.stroke()

    ctx.fillStyle = preset.palette.ink
    ctx.font = font(700, ramp.benefit)
    const textX = tickX + ramp.benefit * 0.75 + (1 - appear) * ramp.benefit * 0.5
    const available = panelWidth - (textX - panelX) - ramp.benefit
    const fitted = fitSingleLine(line.toUpperCase(), available, ramp.benefit, ramp.benefit * 0.5, (s, str) => {
      ctx.font = font(700, s)
      return ctx.measureText(str).width
    })
    ctx.font = font(700, fitted.size)
    ctx.fillText(fitted.text, textX, y)
  })
  ctx.restore()
  ctx.globalAlpha = 1
}

/** "Look inside": interior pages, cross-dissolving, with a standing caption. */
export function drawInterior(input: SceneInput): void {
  const { ctx, width, height, preset, assets, progress, ramp, benefits } = input
  const pages = assets.interiors.length > 0 ? assets.interiors : assets.cover ? [assets.cover] : []
  ctx.globalAlpha = beatOpacity(progress)

  if (pages.length === 0) {
    drawBenefits(input)
    return
  }

  const slot = 1 / pages.length
  const index = Math.min(pages.length - 1, Math.floor(progress / slot))
  const local = (progress - index * slot) / slot

  const box = { x: width * 0.08, y: height * 0.1, width: width * 0.84, height: height * 0.62 }
  const page = pages[index]
  const ratio = page.width / page.height
  let w = box.width
  let h = w / ratio
  if (h > box.height) {
    h = box.height
    w = h * ratio
  }
  // A gentle push-in per page keeps a still photograph feeling like footage.
  const zoom = 1 + 0.05 * local
  w *= zoom
  h *= zoom

  ctx.save()
  ctx.shadowColor = 'rgba(15,10,40,0.28)'
  ctx.shadowBlur = width * 0.04
  ctx.shadowOffsetY = width * 0.01
  ctx.drawImage(page, box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h)
  ctx.restore()

  const caption = benefits[0] ?? 'SEE INSIDE'
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const y = height * 0.84
  ctx.font = font(800, ramp.benefit)
  const textWidth = ctx.measureText(caption.toUpperCase()).width
  ctx.fillStyle = preset.palette.accent
  ctx.beginPath()
  ctx.roundRect(
    width / 2 - textWidth / 2 - ramp.benefit * 0.8,
    y - ramp.benefit * 0.85,
    textWidth + ramp.benefit * 1.6,
    ramp.benefit * 1.7,
    ramp.benefit * 0.85
  )
  ctx.fill()
  ctx.fillStyle = preset.palette.onAccent
  ctx.fillText(caption.toUpperCase(), width / 2, y)
  ctx.restore()
  ctx.globalAlpha = 1
}

/** Rating stars, review count and price — only what we actually know. */
export function drawProof(input: SceneInput): void {
  const { ctx, width, height, preset, ramp, rating, reviewCount, price, progress, assets } = input
  ctx.globalAlpha = beatOpacity(progress)

  const centreY = height * 0.5
  drawCover(
    ctx,
    assets.cover,
    { x: width * 0.06, y: height * 0.18, width: width * 0.32, height: height * 0.64 },
    preset.palette,
    input.title
  )

  const x = width * 0.44
  const appear = easeOut(progress * 1.6)
  ctx.save()
  ctx.globalAlpha *= appear
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  if (rating) {
    const starSize = ramp.headline * 0.5
    for (let i = 0; i < 5; i++) {
      drawStar(ctx, x + i * starSize * 1.15, centreY - ramp.headline * 0.55, starSize * 0.44, i < Math.round(rating) ? preset.palette.accent : 'rgba(0,0,0,0.16)')
    }
    ctx.fillStyle = preset.palette.ink
    ctx.font = font(800, ramp.headline * 0.62)
    ctx.fillText(rating.toFixed(1), x + starSize * 5.9, centreY - ramp.headline * 0.55)
  }

  if (reviewCount) {
    ctx.fillStyle = preset.palette.inkMuted
    ctx.font = font(600, ramp.benefit * 0.86)
    ctx.fillText(`${reviewCount.toLocaleString('en-US')} ratings`, x, centreY + ramp.headline * 0.08)
  }

  if (price) {
    ctx.fillStyle = preset.palette.ink
    ctx.font = font(800, ramp.headline * 0.78)
    ctx.fillText(price, x, centreY + ramp.headline * 0.72)
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawStar(ctx: SKRSContext2D, cx: number, cy: number, r: number, fill: string): void {
  ctx.save()
  ctx.fillStyle = fill
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.46
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const px = cx + Math.cos(angle) * radius
    const py = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Closing frame: cover, title, author, and one unmissable call to action. */
export function drawCta(input: SceneInput): void {
  const { ctx, width, height, preset, assets, ramp, title, author, ctaText, progress } = input
  ctx.globalAlpha = beatOpacity(progress, 0.1)

  // Laid out from the bottom up. Stacking downward from fixed fractions meant a
  // title that wrapped to two lines pushed the author underneath the CTA pill.
  const pad = width * 0.06
  const pulse = 1 + Math.sin(progress * Math.PI) * 0.03
  const pillFontSize = ramp.benefit * pulse
  const pillHeight = ramp.benefit * 2.3
  const pillBottom = height - pad * 1.4
  const pillTop = pillBottom - pillHeight

  ctx.save()
  ctx.textAlign = 'center'

  // CTA pill.
  ctx.font = font(800, pillFontSize)
  const label = ctaText.toUpperCase()
  const pillWidth = Math.min(width - pad * 2, ctx.measureText(label).width + ramp.benefit * 2.4)
  ctx.fillStyle = preset.palette.accent
  ctx.beginPath()
  ctx.roundRect(width / 2 - pillWidth / 2, pillTop, pillWidth, pillHeight, pillHeight / 2)
  ctx.fill()
  ctx.fillStyle = preset.palette.onAccent
  ctx.textBaseline = 'middle'
  ctx.fillText(label, width / 2, pillTop + pillHeight / 2)

  // Author, sitting directly above the pill.
  let cursorY = pillTop - ramp.caption * 0.8
  if (author) {
    ctx.font = font(600, ramp.caption)
    ctx.fillStyle = preset.palette.inkMuted
    ctx.textBaseline = 'bottom'
    ctx.fillText(author, width / 2, cursorY)
    cursorY -= ramp.caption * 1.5
  }

  // Title fills whatever room is left between the cover and the author.
  const coverBottom = height * 0.1 + height * 0.44
  const titleBox = { width: width - pad * 2, height: Math.max(ramp.benefit, cursorY - coverBottom - pad * 0.5) }
  const titleFit = fitText(
    title,
    titleBox,
    ramp.headline * 0.72,
    ramp.benefit * 0.72,
    (s, str) => {
      ctx.font = font(800, s)
      return ctx.measureText(str).width
    },
    ramp.lineHeight
  )
  const lines = titleFit.lines.slice(0, 3)
  ctx.font = font(800, titleFit.size)
  ctx.fillStyle = preset.palette.ink
  ctx.textBaseline = 'bottom'
  lines.forEach((line, i) => {
    const fromBottom = lines.length - 1 - i
    ctx.fillText(line, width / 2, cursorY - fromBottom * titleFit.size * ramp.lineHeight)
  })
  ctx.restore()

  // Cover last so it can never be painted over by the text block.
  const lift = (1 - easeOut(progress * 1.4)) * height * 0.03
  const titleTop = cursorY - lines.length * titleFit.size * ramp.lineHeight
  drawCover(
    ctx,
    assets.cover,
    { x: width * 0.3, y: height * 0.06 + lift, width: width * 0.4, height: titleTop - height * 0.08 },
    preset.palette,
    title
  )
  ctx.globalAlpha = 1
}

export const SCENE_PAINTERS = {
  hook: drawHook,
  benefits: drawBenefits,
  interior: drawInterior,
  proof: drawProof,
  cta: drawCta,
} as const
