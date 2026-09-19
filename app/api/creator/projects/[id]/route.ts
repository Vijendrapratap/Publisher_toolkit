import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import {
  getCreatorProjectForPublisher,
  updateCreatorProject,
  deleteCreatorProject,
} from '@/lib/services/creator/queries'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, id)

  if (!project) {
    return NextResponse.json({ error: 'Book project not found' }, { status: 404 })
  }

  return NextResponse.json({ project })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, id)

  if (!project) {
    return NextResponse.json({ error: 'Book project not found' }, { status: 404 })
  }

  const json = await req.json().catch(() => null)
  if (!json) {
    return NextResponse.json({ error: 'No update data provided' }, { status: 400 })
  }

  const updated = await updateCreatorProject(publisherId, id, json)
  return NextResponse.json({ project: updated })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const success = await deleteCreatorProject(publisherId, id)

  if (!success) {
    return NextResponse.json({ error: 'Book project not found or already deleted' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
