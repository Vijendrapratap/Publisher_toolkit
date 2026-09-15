import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

import { auth } from '@clerk/nextjs/server'
import { requireCurrentPublisherId, UnauthenticatedError, isClerkConfigured, DEV_PUBLISHER_ID } from './auth'

const original = process.env.CLERK_SECRET_KEY
afterEach(() => {
  if (original === undefined) delete process.env.CLERK_SECRET_KEY
  else process.env.CLERK_SECRET_KEY = original
})

describe('isClerkConfigured', () => {
  it('is false when the key is unset', () => {
    delete process.env.CLERK_SECRET_KEY
    expect(isClerkConfigured()).toBe(false)
  })

  it('is false for the placeholder key', () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder'
    expect(isClerkConfigured()).toBe(false)
  })

  it('is true for a real-looking key', () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_abc123'
    expect(isClerkConfigured()).toBe(true)
  })
})

describe('requireCurrentPublisherId', () => {
  it('returns the local publisher id without calling Clerk in local mode', async () => {
    delete process.env.CLERK_SECRET_KEY
    await expect(requireCurrentPublisherId()).resolves.toBe(DEV_PUBLISHER_ID)
    expect(auth).not.toHaveBeenCalled()
  })

  it('returns the Clerk userId when signed in', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_abc123'
    vi.mocked(auth).mockResolvedValue({ userId: 'pub_123' } as any)
    await expect(requireCurrentPublisherId()).resolves.toBe('pub_123')
  })

  it('throws UnauthenticatedError when signed out', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_abc123'
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)
    await expect(requireCurrentPublisherId()).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})
