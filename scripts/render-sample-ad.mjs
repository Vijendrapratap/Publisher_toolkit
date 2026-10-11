// Renders a real ad for a book in the dev database and a contact sheet of its frames.
//   npm run remotion:bundle
//   DATABASE_URL=… node scripts/render-sample-ad.mjs <bookId> [--direct] [--format 16:9] [--out dir]
// --direct asks the AI director (costs a few cents) and draws the setting; otherwise the fixed storyboard.
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createJiti } from 'jiti'

const root = process.cwd()
if (!process.env.OPENROUTER_API_KEY) process.loadEnvFile(path.join(root, '.env.local'))
const args = process.argv.slice(2)
const bookId = args[0]
const flag = (name) => args.includes(name)
const value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
if (!bookId) throw new Error('Usage: node scripts/render-sample-ad.mjs <bookId> [--direct] [--format 16:9] [--out dir]')

const jiti = createJiti(import.meta.url, { alias: { '@': root } })
const { prisma } = await jiti.import('@/lib/db.ts')
const { readVideoSpec, bookVideoSource, resolveMusic } = await jiti.import('@/lib/services/ads/videoSpec.ts')
const { resolveStoryboard } = await jiti.import('@/lib/services/ads/storyboard.ts')
const { bookAdImages, inlineMusic, directorImages } = await jiti.import('@/lib/services/ads/videoAssets.ts')
const { renderAdVideo } = await jiti.import('@/lib/services/ads/renderVideo.ts')
const { getDurationForLength } = await jiti.import('@/lib/services/trailer/options.ts')

const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } })
const base = readVideoSpec(book.videoSpec, bookVideoSource(book))
const spec = { ...base, format: value('--format', base.format) }
let storyboard = resolveStoryboard(spec, book)
if (flag('--direct')) {
  const { directAd, drawSetting } = await jiti.import('@/lib/services/ads/adDirector.ts')
  const result = await directAd(
    { title: book.title ?? 'Untitled book', author: book.author, blurb: book.blurb, bullets: book.bullets, categories: book.categories, pageCount: book.interiorImageUrls.length, cta: spec.script.cta, hook: book.customHook },
    await directorImages(book),
    { format: spec.format, lengthSec: getDurationForLength(spec.length), mood: spec.mood, style: spec.style }
  )
  const settingImageUrl = result.source === 'ai' ? await drawSetting(result.data.theme.settingPrompt, spec.format, book.publisherId) : null
  storyboard = { ...result.data, theme: { ...result.data.theme, settingImageUrl } }
  console.log(`director: ${result.source}${result.reason ? ` (${result.reason})` : ''}`)
}
const out = value('--out', path.join(root, 'test-results', 'sample-ads', `${bookId}-${spec.format.replace(':', 'x')}`))
mkdirSync(out, { recursive: true })
writeFileSync(path.join(out, 'storyboard.json'), JSON.stringify(storyboard, null, 2))

const video = await renderAdVideo(
  {
    spec,
    storyboard,
    title: book.title ?? 'Untitled book',
    author: book.author ?? '',
    musicSrc: await inlineMusic(resolveMusic(spec), book.publisherId),
    ...(await bookAdImages(book, storyboard, book.publisherId)),
  },
  'BookAd'
)
writeFileSync(path.join(out, 'ad.mp4'), video.videoBuffer)
// One tile every 0.75 s, enough rows for the whole video.
const rows = Math.ceil(video.durationSec / 0.75 / 4)
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(out, 'ad.mp4'), '-vf', `fps=1/0.75,scale=400:-1,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=4x${rows}`, '-frames:v', '1', path.join(out, 'sheet.png')])
console.log(`ad: ${path.join(out, 'ad.mp4')} (${video.durationSec.toFixed(1)}s)\nsheet: ${path.join(out, 'sheet.png')}`)
await prisma.$disconnect()
