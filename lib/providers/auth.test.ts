import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: Object.assign(vi.fn(), { protect: vi.fn(async () => ({ userId: 'user_clerk_1' })) }),
  currentUser: vi.fn(async () => ({ primaryEmailAddress: { emailAddress: 'reader@example.com' } })),
}))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), connection: vi.fn(async () => {}) }))
vi.mock('@/lib/credits/ledger', () => ({ ensureUser: vi.fn(async (id: string) => ({ id })) }))

import { auth } from '@clerk/nextjs/server'
import { ensureUser } from '@/lib/credits/ledger'
import { DEV_PUBLISHER_ID, requireCurrentPublisherId } from './auth'

const setKeys = (on: boolean) => {
  vi.stubEnv('CLERK_SECRET_KEY', on ? 'sk_test_real' : '')
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', on ? 'pk_test_real' : '')
}

describe('requireCurrentPublisherId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('uses auth.protect() and ensures the user row when Clerk is configured', async () => {
    setKeys(true)
    await expect(requireCurrentPublisherId()).resolves.toBe('user_clerk_1')
    expect(auth.protect).toHaveBeenCalled()
    expect(ensureUser).toHaveBeenCalledWith('user_clerk_1', expect.any(Function))
  })

  it('falls back to the dev publisher outside production', async () => {
    setKeys(false)
    vi.stubEnv('NODE_ENV', 'development')
    await expect(requireCurrentPublisherId()).resolves.toBe(DEV_PUBLISHER_ID)
    expect(ensureUser).toHaveBeenCalledWith(DEV_PUBLISHER_ID, expect.any(Function))
  })

  it('refuses the dev fallback in production', async () => {
    setKeys(false)
    vi.stubEnv('NODE_ENV', 'production')
    await expect(requireCurrentPublisherId()).rejects.toThrow(/Clerk/)
  })
})
