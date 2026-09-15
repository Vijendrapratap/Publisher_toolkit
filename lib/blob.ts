import { put } from '@vercel/blob'

// Local dev without a real Vercel Blob token: return the file as a data:
// URI instead of uploading it. A locally-served static path won't work here
// because next/og's ImageResponse (lib/compositing/renderCreativeImages.tsx)
// requires an absolute image URL to fetch covers from, and the dev server's
// own origin/port isn't reliably known at upload time — a data: URI needs
// no origin at all. Swap in a real token and this stops firing automatically.
function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

export async function uploadToBlob(pathname: string, data: Buffer, contentType: string): Promise<{ url: string }> {
  if (!isBlobConfigured()) {
    return { url: `data:${contentType};base64,${data.toString('base64')}` }
  }
  const blob = await put(pathname, data, { access: 'public', contentType })
  return { url: blob.url }
}
