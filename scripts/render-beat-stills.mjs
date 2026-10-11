// Renders one still from the middle of every beat of a sample storyboard, for a quick look.
//   npm run remotion:bundle && node scripts/render-beat-stills.mjs [outDir]
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { createJiti } from 'jiti'
import { renderStill, selectComposition, ensureBrowser } from '@remotion/renderer'

const root = process.cwd()
const jiti = createJiti(import.meta.url, { alias: { '@': root } })
const { fixedStoryboard, beatStartFrames, beatFrames } = await jiti.import('@/lib/services/ads/storyboard.ts')
const { presetStyle, defaultVideoSpec } = await jiti.import('@/lib/services/ads/videoSpec.ts')
const out = process.argv[2] ?? path.join(root, 'test-results', 'beat-stills')
mkdirSync(out, { recursive: true })

const storyboard = fixedStoryboard({ title: 'Murder at Thornwick Mill', blurb: 'A murder mystery told in 120 word searches.', bullets: ['For fans of cosy crime'], pageCount: 0, cta: 'Get your copy', lengthSec: 20, style: presetStyle('cinematic') })
for (const format of ['16:9', '1:1', '9:16']) {
  const inputProps = { spec: { ...defaultVideoSpec({ title: 'T' }), format }, storyboard, title: 'Murder at Thornwick Mill', author: '', coverUrl: null, pageUrls: [], settingUrl: null }
  await ensureBrowser()
  const serveUrl = path.join(root, '.remotion-bundle')
  const composition = await selectComposition({ serveUrl, id: 'BookAd', inputProps })
  const starts = beatStartFrames(storyboard.beats)
  for (const [i, beat] of storyboard.beats.entries()) {
    const frame = starts[i] + Math.floor(beatFrames(beat) / 2)
    await renderStill({ composition, serveUrl, inputProps, frame, output: path.join(out, `${format.replace(':', 'x')}-${i}-${beat.kind}.png`) })
  }
}
console.log(`stills written to ${out}`)
