import { describe, it, expect } from 'vitest'
import net from 'node:net'
import { isPortOpen } from './embedded-db.mjs'

describe('isPortOpen', () => {
  it('detects a listening port and a closed one', async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as net.AddressInfo
    expect(await isPortOpen(port)).toBe(true)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    expect(await isPortOpen(port)).toBe(false)
  })
})
