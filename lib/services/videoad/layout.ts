import type { BeatKind } from './presets'

/**
 * These ads are watched in a ~300px Amazon carousel tile, muted. Anything the
 * viewer cannot read at that size may as well not be on screen, so every type
 * size is derived from the tile, never from the canvas.
 */

/** Smallest comfortably legible size once the canvas is scaled into a tile. */
export const MIN_TILE_PX = 11

/** Canvas pixels needed for `tileTarget` rendered pixels in the tile. */
export function typeScale(canvasHeight: number, tilePx: number, tileTarget: number): number {
  return Math.round(tileTarget * (canvasHeight / tilePx))
}

export function minLegiblePx(canvasHeight: number, tilePx: number): number {
  return typeScale(canvasHeight, tilePx, MIN_TILE_PX)
}

export function isLegible(sizePx: number, canvasHeight: number, tilePx: number): boolean {
  return sizePx >= minLegiblePx(canvasHeight, tilePx)
}

export interface TypeRamp {
  headline: number
  benefit: number
  label: number
  caption: number
  lineHeight: number
}

/**
 * One ramp for the whole ad. Sizes are in canvas pixels and every one of them
 * clears the tile-legibility floor.
 */
export function typeRamp(canvasHeight: number, tilePx: number): TypeRamp {
  const at = (tileTarget: number) => typeScale(canvasHeight, tilePx, tileTarget)
  const floor = minLegiblePx(canvasHeight, tilePx)
  const clamp = (value: number) => Math.max(floor, value)

  return {
    headline: clamp(at(30)),
    benefit: clamp(at(17)),
    label: clamp(at(12)),
    caption: clamp(at(13)),
    lineHeight: 1.16,
  }
}

export interface Beat {
  kind: BeatKind
  startSec: number
  durationSec: number
}

/**
 * Weights, not fixed seconds: the same plan has to work at 6s and at 30s.
 * The hook holds longest because most impressions never reach beat two.
 */
const BEAT_WEIGHTS: Record<BeatKind, number> = {
  hook: 3,
  benefits: 3,
  interior: 2.5,
  proof: 2,
  cta: 2,
}

/** Below this a beat cannot land, so it is dropped rather than flashed. */
export const MIN_BEAT_SEC = 1.6

/**
 * Lays the preset's beats into the available time, dropping the least
 * important ones when there is not enough room. `hook` and `cta` always
 * survive: an ad with no claim or no call to action is not an ad.
 */
export function planBeats(kinds: BeatKind[], durationSec: number, available: Set<BeatKind>): Beat[] {
  const required: BeatKind[] = ['hook', 'cta']
  let candidates = kinds.filter((k) => available.has(k) || required.includes(k))

  // The shortest beat, not the average one: the weights are uneven, so a plan
  // whose mean clears the floor can still contain a beat that flashes past.
  const shortestBeat = (list: BeatKind[]) => {
    const totalWeight = list.reduce((sum, k) => sum + BEAT_WEIGHTS[k], 0)
    const lightest = Math.min(...list.map((k) => BEAT_WEIGHTS[k]))
    return (lightest / totalWeight) * durationSec
  }

  // Drop optional beats, least important first, until each survivor can hold.
  const droppable: BeatKind[] = ['proof', 'interior', 'benefits']
  for (const kind of droppable) {
    if (candidates.length <= 2) break
    if (shortestBeat(candidates) >= MIN_BEAT_SEC) break
    candidates = candidates.filter((k) => k !== kind)
  }

  const totalWeight = candidates.reduce((sum, k) => sum + BEAT_WEIGHTS[k], 0)
  let cursor = 0
  return candidates.map((kind) => {
    const beatDuration = (BEAT_WEIGHTS[kind] / totalWeight) * durationSec
    const beat = { kind, startSec: cursor, durationSec: beatDuration }
    cursor += beatDuration
    return beat
  })
}

export function beatAt(beats: Beat[], timeSec: number): { beat: Beat; progress: number } {
  const beat = beats.find((b) => timeSec < b.startSec + b.durationSec) ?? beats[beats.length - 1]
  const progress = (timeSec - beat.startSec) / beat.durationSec
  return { beat, progress: Math.min(1, Math.max(0, progress)) }
}

/** Decelerating ease — motion should arrive and settle, never drift. */
export function easeOut(p: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3)
}

/**
 * Fades in, holds, fades out. Used so each beat's content is fully opaque for
 * most of its time rather than permanently mid-transition.
 */
export function beatOpacity(progress: number, fadeRatio = 0.14): number {
  if (progress < fadeRatio) return progress / fadeRatio
  if (progress > 1 - fadeRatio) return (1 - progress) / fadeRatio
  return 1
}

/** Staggered reveal index for lists, e.g. benefit lines appearing in turn. */
export function stagger(progress: number, count: number, holdRatio = 0.65): number[] {
  const step = holdRatio / Math.max(1, count)
  return Array.from({ length: count }, (_, i) => easeOut((progress - i * step) / step))
}

/** Greedy word wrap against a measured width. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  let current = ''

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measure(candidate) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Shrinks the size until the text fits the box, so a long title degrades
 * gracefully instead of overflowing the canvas.
 *
 * Both axes are checked. Height alone is not enough: a single long word such as
 * "SOLUTIONS" cannot be wrapped, so it stays wider than the column at every
 * size and would otherwise be accepted and painted across whatever sits beside
 * it.
 */
export function fitText(
  text: string,
  box: { width: number; height: number },
  startSize: number,
  minSize: number,
  measureAt: (size: number, s: string) => number,
  lineHeight = 1.16
): { size: number; lines: string[] } {
  const step = Math.max(1, Math.round(startSize * 0.04))

  for (let size = startSize; size > minSize; size -= step) {
    const lines = wrapLines(text, box.width, (s) => measureAt(size, s))
    const fitsHeight = lines.length * size * lineHeight <= box.height
    const fitsWidth = lines.every((line) => measureAt(size, line) <= box.width)
    if (fitsHeight && fitsWidth) return { size, lines }
  }
  return { size: minSize, lines: wrapLines(text, box.width, (s) => measureAt(minSize, s)) }
}

/**
 * Fits one line by shrinking it, never by cutting it.
 *
 * Benefit lines are the claims the ad is making — silently dropping the last
 * word turns "100 INTERESTING THEMES" into "100 INTERESTING", which is not a
 * claim at all. Only a line that cannot fit even at the floor is truncated,
 * and then it is marked with an ellipsis rather than just ending.
 */
export function fitSingleLine(
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  measureAt: (size: number, s: string) => number
): { size: number; text: string } {
  const step = Math.max(1, Math.round(startSize * 0.04))

  for (let size = startSize; size >= minSize; size -= step) {
    if (measureAt(size, text) <= maxWidth) return { size, text }
  }

  let truncated = text
  while (truncated.length > 1 && measureAt(minSize, `${truncated}…`) > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return { size: minSize, text: `${truncated}…` }
}

/**
 * Skia only understands the standard CSS weight ladder. Asking for an
 * in-between weight like 750 is accepted by `ctx.font` but returns nonsense
 * metrics — `measureText` reported 2083px for a 38px font — so text was laid
 * out at roughly fifty times its intended size.
 */
export function safeFontWeight(weight: number): number {
  const clamped = Math.min(900, Math.max(100, weight))
  return Math.round(clamped / 100) * 100
}
