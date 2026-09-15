import { put } from '@vercel/blob'

export async function uploadToBlob(pathname: string, data: Buffer, contentType: string): Promise<{ url: string }> {
  const blob = await put(pathname, data, { access: 'public', contentType })
  return { url: blob.url }
}
