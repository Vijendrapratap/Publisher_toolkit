// One-time: draws a sample picture for every picture style in Create a book,
// so the style picker shows what each style looks like. Re-run to fill gaps;
// pass --force to redraw all. Uses OPENROUTER_API_KEY and OPENROUTER_IMAGE_MODEL
// from .env.local and the same prompt builder the books use.
//   node scripts/style-samples.mjs [--force]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createJiti } from 'jiti'
import sharp from 'sharp'

process.loadEnvFile('.env.local')
const jiti = createJiti(import.meta.url)
const { STYLES_BY_TYPE } = await jiti.import('../lib/services/creator/options.ts')
const { buildStyleBible, collectPrompts } = await jiti.import('../lib/services/creator/illustrate-shared.ts')

const SCENE = 'A little red fox and a small hedgehog reading a picture book together under a big oak tree'
// One page of each kind, so each sample goes through the real prompt for its book type.
const CONTENT = {
  children: {
    type: 'children',
    pages: [{ pageNumber: 1, storyText: '', characterFocus: 'a little red fox and a small hedgehog', illustrationPrompt: `${SCENE}, on a sunny afternoon.` }],
  },
  coloring: {
    type: 'coloring',
    pages: [{ pageNumber: 1, sceneDescription: SCENE, lineArtPrompt: `Coloring book page: ${SCENE}.` }],
  },
  short_story: {
    type: 'short_story',
    story: { title: 'Under the Oak', illustrationPrompt: `${SCENE} at dusk.` },
  },
}

const force = process.argv.includes('--force')
const apiKey = process.env.OPENROUTER_API_KEY
const model = process.env.OPENROUTER_IMAGE_MODEL
if (!apiKey || !model) throw new Error('Set OPENROUTER_API_KEY and OPENROUTER_IMAGE_MODEL in .env.local')

async function draw(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`image model returned ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const first = (await res.json()).data?.[0]
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64')
  if (first?.url) return Buffer.from(await (await fetch(first.url)).arrayBuffer())
  throw new Error('image model returned no image')
}

let made = 0
for (const [type, content] of Object.entries(CONTENT)) {
  mkdirSync(`public/styles/${type}`, { recursive: true })
  for (const style of STYLES_BY_TYPE[type]) {
    const out = `public/styles/${type}/${style.key}.webp`
    if (existsSync(out) && !force) continue
    const [{ prompt }] = collectPrompts(structuredClone(content), buildStyleBible(content, style.key))
    try {
      const image = await draw(prompt)
      writeFileSync(out, await sharp(image).resize({ width: 480, height: 360, fit: 'cover' }).webp({ quality: 72 }).toBuffer())
      made++
      console.log('drew', out)
    } catch (err) {
      console.error('failed', out, err.message)
    }
  }
}
console.log(`done: ${made} drawn`)
