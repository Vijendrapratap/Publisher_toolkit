import { NextResponse } from 'next/server'
import { requireCurrentPublisherId, isClerkConfigured } from '@/lib/providers/auth'

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  return NextResponse.json({
    publisherId,
    isClerk: isClerkConfigured(),
  })
}
