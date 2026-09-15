import { describe, it, expect, afterEach } from 'vitest'
import { getCapabilityStatus, isFullyLocal } from './status'

const keys = ['CLERK_SECRET_KEY', 'BLOB_READ_WRITE_TOKEN', 'AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN'] as const
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('getCapabilityStatus', () => {
  it('reports everything local when no credentials are set', () => {
    for (const k of keys) delete process.env[k]
    const status = getCapabilityStatus()
    expect(status).toEqual({ auth: 'local', storage: 'local', ai: 'local', adsPush: 'local' })
    expect(isFullyLocal(status)).toBe(true)
  })

  it('reports real per capability as credentials appear', () => {
    for (const k of keys) delete process.env[k]
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_x'
    const status = getCapabilityStatus()
    expect(status.storage).toBe('real')
    expect(status.auth).toBe('local')
    expect(isFullyLocal(status)).toBe(false)
  })
})
