import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadLora } from '@remotion/google-fonts/Lora'
import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel'
import { loadFont as loadMerriweather } from '@remotion/google-fonts/Merriweather'
import { loadFont as loadCaveat } from '@remotion/google-fonts/Caveat'
import type { AdFontKey } from '@/lib/services/ads/videoSpec'

// Only the weights the scenes use: every weight of eight families would stall
// the first frame while they download.
const LOADERS: Record<AdFontKey, () => { fontFamily: string }> = {
  inter: () => loadInter('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }),
  montserrat: () => loadMontserrat('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }),
  bebas: () => loadBebas('normal', { weights: ['400'], subsets: ['latin'] }),
  playfair: () => loadPlayfair('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  lora: () => loadLora('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  cinzel: () => loadCinzel('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  merriweather: () => loadMerriweather('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  caveat: () => loadCaveat('normal', { weights: ['400', '700'], subsets: ['latin'] }),
}

const loaded = new Map<AdFontKey, string>()

/** Loads a font once and returns its CSS family. Remotion holds rendering until it is ready. */
export function adFontFamily(key: AdFontKey): string {
  let family = loaded.get(key)
  if (!family) {
    family = (LOADERS[key] ?? LOADERS.inter)().fontFamily
    loaded.set(key, family)
  }
  return `${family}, sans-serif`
}
