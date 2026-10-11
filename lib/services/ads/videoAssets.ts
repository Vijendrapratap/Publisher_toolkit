import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { readStoredFile, toDataUri } from '@/lib/providers/storage'
import { ownsMusicUpload, type AdVideoSpec } from './videoSpec'
import type { DirectorImage } from './adDirector'
import { STORYBOARD_LIMITS, ownsStoredFile, pagesUsed, settingsPath, type Storyboard } from './storyboard'

/** Headless Chrome and OpenRouter have no session cookie, so stored images travel inline. */
export async function inlineImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    return toDataUri(await readStoredFile(url))
  } catch {
    return null
  }
}

/** The chosen music as a data URI for the server render; bundled tracks are read from public/. */
export async function inlineMusic(music: NonNullable<AdVideoSpec['music']>, publisherId: string): Promise<string | null> {
  if (music.kind === 'none') return null
  if (music.kind === 'library') {
    const data = await readFile(path.join(process.cwd(), 'public', 'music', `${music.track}.mp3`))
    return `data:audio/mpeg;base64,${data.toString('base64')}`
  }
  // Never read a URL the client sent that isn't actually this publisher's own upload.
  if (!ownsMusicUpload(music, publisherId)) return null
  return inlineImage(music.url)
}

/** Path of a bundled track on disk, or the upload copied to `dir`; for ffmpeg. */
export async function musicFile(music: NonNullable<AdVideoSpec['music']>, dir: string, publisherId: string): Promise<string | null> {
  if (music.kind === 'none') return null
  if (music.kind === 'library') return path.join(process.cwd(), 'public', 'music', `${music.track}.mp3`)
  if (!ownsMusicUpload(music, publisherId)) return null
  try {
    const target = path.join(dir, 'music-upload')
    await writeFile(target, (await readStoredFile(music.url)).data)
    return target
  } catch {
    return null
  }
}

/** Everything BookAd draws, inline for headless Chrome; pages the storyboard doesn't show stay null. */
export async function bookAdImages(
  book: { frontCoverUrl: string | null; interiorImageUrls: string[] },
  storyboard: Storyboard,
  publisherId: string
) {
  const used = new Set(pagesUsed(storyboard))
  const setting = storyboard.theme.settingImageUrl
  const [coverUrl, settingUrl, ...pageUrls] = await Promise.all([
    inlineImage(book.frontCoverUrl),
    setting && ownsStoredFile(setting, settingsPath(publisherId)) ? inlineImage(setting) : Promise.resolve(null),
    ...book.interiorImageUrls.map((url, i) => (used.has(i + 1) ? inlineImage(url) : Promise.resolve(null))),
  ])
  return { coverUrl, settingUrl, pageUrls }
}

/** The cover and up to 6 pages as raw bytes for the director; pictures that fail to load are skipped. */
export async function directorImages(book: { frontCoverUrl: string | null; interiorImageUrls: string[] }): Promise<DirectorImage[]> {
  const sources = [
    { label: 'cover', url: book.frontCoverUrl },
    ...book.interiorImageUrls.slice(0, STORYBOARD_LIMITS.pages).map((url, i) => ({ label: `page ${i + 1}`, url })),
  ]
  const loaded = await Promise.all(
    sources.map(async ({ label, url }) => {
      if (!url) return null
      try {
        const file = await readStoredFile(url)
        return { label, data: file.data, mediaType: file.contentType }
      } catch {
        return null
      }
    })
  )
  // ponytail: images go at stored size; downscale here if token cost or latency becomes a problem.
  return loaded.filter((i): i is DirectorImage => i !== null)
}
