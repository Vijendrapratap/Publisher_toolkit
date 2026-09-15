import { describe, it, expect, vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { requireCurrentPublisherId, UnauthenticatedError } from './auth'

describe('requireCurrentPublisherId', () => {
  it('returns the Clerk userId when signed in', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'pub_123' } as any)
    await expect(requireCurrentPublisherId()).resolves.toBe('pub_123')
  })

  it('throws UnauthenticatedError when signed out', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)
    await expect(requireCurrentPublisherId()).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})
