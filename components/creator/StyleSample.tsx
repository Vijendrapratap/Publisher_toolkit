import type { BookTypeKey } from '@/lib/services/creator/options'

/** Book types whose styles are art styles, with a drawn sample in public/styles (scripts/style-samples.mjs). */
export const PICTURE_STYLE_TYPES: BookTypeKey[] = ['children', 'coloring', 'short_story']

export const styleSampleUrl = (type: BookTypeKey, key: string) => `/styles/${type}/${key}.webp`

/** What a style looks like: the sample picture, or for puzzle books a small real puzzle. */
export function StyleSample({ type, styleKey, label }: { type: BookTypeKey; styleKey: string; label: string }) {
  if (PICTURE_STYLE_TYPES.includes(type)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={styleSampleUrl(type, styleKey)}
        alt={`Sample picture in the ${label} style`}
        width={480}
        height={360}
        className="aspect-[4/3] w-full bg-surface-2 object-cover"
      />
    )
  }
  return (
    <div data-testid="puzzle-sample" aria-hidden className="grid aspect-[4/3] w-full place-items-center bg-white p-3 text-neutral-800">
      <div className="scale-[1.4]">
        <PuzzleSample styleKey={styleKey} />
      </div>
    </div>
  )
}

const SEARCH = ['OCEANS', 'XRQWEL', 'FISHTB', 'KCORAL', 'ZWAVEM']
const FOUND = new Set(['0-0', '0-1', '0-2', '0-3', '0-4', '3-1', '3-2', '3-3', '3-4', '3-5'])
// 5×5 mini crossword: '#' is a black square, a digit marks a clue start.
const CROSSWORD = ['1  2#', ' ## #', '3    ', '#  # ', '4    ']

function PuzzleSample({ styleKey }: { styleKey: string }) {
  if (styleKey === 'crossword_classic') {
    return (
      <div className="grid grid-cols-5 border border-neutral-800">
        {CROSSWORD.join('').split('').map((c, i) => (
          <span key={i} className={`relative size-6 border border-neutral-400 ${c === '#' ? 'bg-neutral-800' : ''}`}>
            {/\d/.test(c) && <span className="absolute left-0.5 top-0 text-[7px] leading-none">{c}</span>}
          </span>
        ))}
      </div>
    )
  }
  if (styleKey === 'word_scramble') {
    return (
      <div className="flex flex-col items-center gap-2 font-mono text-sm">
        {[['NAOCE', 'OCEAN'], ['HLAEW', 'WHALE'], ['LRAOC', '?????']].map(([jumbled, answer]) => (
          <div key={jumbled} className="flex items-center gap-2">
            <span className="flex gap-0.5">
              {jumbled.split('').map((l, i) => (
                <span key={i} className="grid size-5 place-items-center rounded bg-neutral-200 text-xs font-bold">{l}</span>
              ))}
            </span>
            <span className="text-neutral-400">→</span>
            <span className="w-14 border-b border-neutral-400 text-center text-xs tracking-widest">{answer}</span>
          </div>
        ))}
      </div>
    )
  }
  if (styleKey === 'kids_vocab_hunt') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1 text-xl leading-none">
          <span>🐟</span>
          <span>🐙</span>
          <span>🐢</span>
        </div>
        <div className="grid grid-cols-4 gap-0.5 font-mono text-base font-bold">
          {'FISHAOCTURTLEBNP'.split('').map((l, i) => (
            <span key={i} className={`grid size-6 place-items-center rounded ${i < 4 ? 'bg-amber-200' : ''}`}>{l}</span>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <div className="grid grid-cols-6 gap-px font-mono text-xs font-semibold">
        {SEARCH.flatMap((row, r) =>
          row.split('').map((l, c) => (
            <span key={`${r}-${c}`} className={`grid size-5 place-items-center rounded-sm ${FOUND.has(`${r}-${c}`) ? 'bg-sky-200' : ''}`}>{l}</span>
          ))
        )}
      </div>
      <ul className="text-[10px] leading-4 text-neutral-500">
        <li className="line-through">OCEAN</li>
        <li className="line-through">CORAL</li>
        <li>FISH</li>
        <li>WAVE</li>
      </ul>
    </div>
  )
}
