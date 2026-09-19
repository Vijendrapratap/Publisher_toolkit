import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { publisherId, email, studioName } = body

  const targetId =
    typeof publisherId === 'string' && publisherId.trim()
      ? publisherId.trim()
      : typeof email === 'string' && email.trim()
        ? `pub_${email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`
        : 'dev-local-publisher'

  const cookieStore = await cookies()
  cookieStore.set('pt_publisher_id', targetId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return NextResponse.json({
    success: true,
    publisherId: targetId,
    studioName: studioName || 'Publisher Studio',
  })
}
