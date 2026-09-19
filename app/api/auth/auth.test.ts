import { describe, it, expect, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  }),
}))

import { POST as loginPOST } from './login/route'
import { POST as logoutPOST } from './logout/route'
import { cookies } from 'next/headers'

describe('Auth routes', () => {
  it('sets session cookie on login', async () => {
    const mockCookieStore = { set: vi.fn(), delete: vi.fn() }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisherId: 'my_imprint_1', studioName: 'My Press' }),
    })

    const res = await loginPOST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.publisherId).toBe('my_imprint_1')
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'pt_publisher_id',
      'my_imprint_1',
      expect.objectContaining({ path: '/', httpOnly: true })
    )
  })

  it('deletes session cookie on logout', async () => {
    const mockCookieStore = { set: vi.fn(), delete: vi.fn() }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

    const res = await logoutPOST()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockCookieStore.delete).toHaveBeenCalledWith('pt_publisher_id')
  })
})
