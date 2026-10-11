import { describe, it, expect, afterAll } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { pageFetch } from './pageFetch'

let lastHeaders: http.IncomingHttpHeaders = {}
const server = http
  .createServer((req, res) => {
    lastHeaders = req.headers
    if (req.url === '/moved') {
      res.writeHead(301, { location: '/book' })
      return res.end()
    }
    if (req.url === '/slow') return // never answers
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<h1>Book</h1>')
  })
  .listen(0)
const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`
afterAll(() => void server.close())

describe('pageFetch', () => {
  it('sends only our headers — no sec-fetch-mode, which stores read as a bot', async () => {
    const res = await pageFetch(`${base()}/book`, { headers: { 'User-Agent': 'test-agent' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toBe('<h1>Book</h1>')
    expect(lastHeaders['user-agent']).toBe('test-agent')
    expect(lastHeaders['sec-fetch-mode']).toBeUndefined()
  })

  it('hands redirects back to the caller instead of following them', async () => {
    const res = await pageFetch(`${base()}/moved`, {})
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/book')
  })

  it('gives up when the signal aborts', async () => {
    await expect(pageFetch(`${base()}/slow`, { signal: AbortSignal.timeout(50) })).rejects.toThrow()
  })
})
