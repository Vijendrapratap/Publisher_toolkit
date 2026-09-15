import { put } from '@vercel/blob'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const LOCAL_URL_PREFIX = '/api/files/'

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export function localStorageRoot(): string {
  return process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), '.local-storage')
}

export function contentTypeFor(pathname: string): string {
  return CONTENT_TYPES[path.extname(pathname).toLowerCase()] ?? 'application/octet-stream'
}

export function resolveLocalPath(pathname: string): string {
  const segments = pathname.split('/')
  if (pathname.startsWith('/') || segments.some((s) => s === '..' || s === '')) {
    throw new Error('invalid path')
  }
  return path.join(localStorageRoot(), ...segments)
}

export async function storeFile(pathname: string, data: Buffer, contentType: string): Promise<{ url: string }> {
  if (isBlobConfigured()) {
    const blob = await put(pathname, data, { access: 'public', contentType })
    return { url: blob.url }
  }
  const filePath = resolveLocalPath(pathname)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, data)
  return { url: `${LOCAL_URL_PREFIX}${pathname}` }
}

export async function readStoredFile(url: string): Promise<{ data: Buffer; contentType: string }> {
  if (url.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.*)$/.exec(url)
    if (!match) throw new Error('invalid data URI')
    return { contentType: match[1], data: Buffer.from(match[2], 'base64') }
  }
  if (url.startsWith(LOCAL_URL_PREFIX)) {
    const pathname = url.slice(LOCAL_URL_PREFIX.length)
    return { data: await readFile(resolveLocalPath(pathname)), contentType: contentTypeFor(pathname) }
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`failed to fetch stored file: ${res.status}`)
  return {
    data: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  }
}

export function toDataUri(file: { data: Buffer; contentType: string }): string {
  return `data:${file.contentType};base64,${file.data.toString('base64')}`
}
