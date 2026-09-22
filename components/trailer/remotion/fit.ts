/** Shrinks long text instead of letting it overflow the frame; never below `floor` × base. */
export function fitFontSize(base: number, text: string, comfortableChars: number, floor = 0.55): number {
  const length = text.trim().length
  if (length <= comfortableChars) return Math.round(base)
  return Math.round(base * Math.max(floor, Math.sqrt(comfortableChars / length)))
}
