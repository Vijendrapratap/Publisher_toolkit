import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import {
  requireCurrentPublisherId,
  UnauthenticatedError,
  isClerkConfigured,
  DEV_PUBLISHER_ID,
  PUBLISHER_COOKIE,
} from './auth'

const env = { ...process.env }

function configureClerk() {
  process.env.CLERK_SECRET_KEY = 'sk_test_abc123'
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_abc123'
}

function mockCookie(value?: string) {
  vi.mocked(cookies).mockResolvedValue({ get: () => (value ? { value } : undefined) } as never)
}

beforeEach(() => {
  delete process.env.CLERK_SECRET_KEY
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  mockCookie()
})

afterEach(() => {
  process.env = { ...env }
  vi.mocked(auth).mockReset()
})

describe('isClerkConfigured', () => {
  it('is false when the keys are unset', () => {
    expect(isClerkConfigured()).toBe(false)
  })

  it('is false for the placeholder keys', () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder'
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder'
    expect(isClerkConfigured()).toBe(false)
  })

  it('is false with a secret but no publishable key, which would crash at boot', () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_abc123'
    expect(isClerkConfigured()).toBe(false)
  })

  it('is true once both real keys are present', () => {
    configureClerk()
    expect(isClerkConfigured()).toBe(true)
  })
})

describe('requireCurrentPublisherId', () => {
  it('returns the local publisher id without calling Clerk in local mode', async () => {
    await expect(requireCurrentPublisherId()).resolves.toBe(DEV_PUBLISHER_ID)
    expect(auth).not.toHaveBeenCalled()
  })

  it('reads the local session cookie when one is set', async () => {
    mockCookie('pub_local_42')
    await expect(requireCurrentPublisherId()).resolves.toBe('pub_local_42')
    expect(PUBLISHER_COOKIE).toBe('pt_publisher_id')
  })

  it('returns the Clerk userId when signed in', async () => {
    configureClerk()
    vi.mocked(auth).mockResolvedValue({ userId: 'pub_123' } as never)
    await expect(requireCurrentPublisherId()).resolves.toBe('pub_123')
  })

  it('throws UnauthenticatedError when signed out', async () => {
    configureClerk()
    vi.mocked(auth).mockResolvedValue({ userId: null } as never)
    await expect(requireCurrentPublisherId()).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})
