import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { readStoredFile, toDataUri } from '@/lib/providers/storage'
import { ownsMusicUpload, type AdVideoSpec } from './videoSpec'

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

export async function adVideoImages(book: { frontCoverUrl: string | null; interiorImageUrls: string[] }) {
  const [coverUrl, ...interiors] = await Promise.all([
    inlineImage(book.frontCoverUrl),
    ...book.interiorImageUrls.slice(0, 2).map(inlineImage),
  ])
  return { coverUrl, interiorImageUrls: interiors.filter((u): u is string => Boolean(u)) }
}
