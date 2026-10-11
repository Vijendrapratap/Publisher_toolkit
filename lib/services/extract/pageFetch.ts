import http from 'node:http'
import https from 'node:https'
import { Readable } from 'node:stream'

/**
 * A `fetch` for reading store pages. Node's built-in fetch always adds
 * `sec-fetch-mode: cors` and won't let us remove it; Amazon answers any page
 * request carrying it with a robot-check page. node:https sends only the
 * headers we pass. Redirects come back to the caller unfollowed.
 */
export function pageFetch(url: string, init: { headers?: Record<string, string>; signal?: AbortSignal }): Promise<Response> {
  const client = url.startsWith('https:') ? https : http
  return new Promise((resolve, reject) => {
    const req = client.get(url, { headers: init.headers, signal: init.signal }, (res) => {
      const headers = new Headers()
      for (const [name, value] of Object.entries(res.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      }
      const status = res.statusCode ?? 502
      const noBody = status === 204 || status === 304
      if (noBody) res.resume()
      resolve(new Response(noBody ? null : (Readable.toWeb(res) as ReadableStream), { status, headers }))
    })
    req.on('error', reject)
  })
}
