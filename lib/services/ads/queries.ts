import { prisma } from '@/lib/db'
import type { Book, AdCopy } from '@prisma/client'

export function getBooksForPublisher(publisherId: string): Promise<Book[]> {
  return prisma.book.findMany({ where: { publisherId }, orderBy: { createdAt: 'desc' } })
}

export function getBookForPublisher(publisherId: string, bookId: string): Promise<Book | null> {
  return prisma.book.findFirst({ where: { id: bookId, publisherId } })
}

export function getLatestCreativeSetForBook(bookId: string, publisherId: string) {
  return prisma.creativeSet.findFirst({
    where: { bookId, book: { publisherId } },
    orderBy: { createdAt: 'desc' },
    include: { adCopies: true, images: true },
  })
}

export function getAdCopyForPublisher(publisherId: string, copyId: string): Promise<AdCopy | null> {
  return prisma.adCopy.findFirst({ where: { id: copyId, creativeSet: { book: { publisherId } } } })
}

export async function getPublisherBookLibrary(publisherId: string) {
  const books = await prisma.book.findMany({
    where: { publisherId },
    orderBy: { createdAt: 'desc' },
    include: {
      creativeSets: { select: { id: true } },
    },
  })

  // Deduplicate by distinct title/PDF to present a clean catalog of books,
  // showing total campaigns associated with each book.
  const map = new Map<string, {
    id: string
    title: string
    author: string
    blurb: string
    pdfUrl: string
    frontCoverUrl: string | null
    backCoverUrl: string | null
    campaignCount: number
    createdAt: Date
  }>()

  for (const b of books) {
    const key = (b.title ?? b.id).trim().toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        id: b.id,
        title: b.title || 'Untitled book',
        author: b.author || 'Unknown author',
        blurb: b.blurb || '',
        pdfUrl: b.pdfUrl,
        frontCoverUrl: b.frontCoverUrl,
        backCoverUrl: b.backCoverUrl,
        campaignCount: 1,
        createdAt: b.createdAt,
      })
    } else {
      existing.campaignCount += 1
      if (!existing.frontCoverUrl && b.frontCoverUrl) {
        existing.frontCoverUrl = b.frontCoverUrl
      }
    }
  }

  return Array.from(map.values())
}

export async function getCampaignsForBook(publisherId: string, bookId: string) {
  const target = await prisma.book.findFirst({ where: { id: bookId, publisherId } })
  if (!target) return []
  const rootId = target.parentBookId ?? target.id
  return prisma.book.findMany({
    where: {
      publisherId,
      OR: [{ id: rootId }, { parentBookId: rootId }],
    },
    orderBy: { createdAt: 'desc' },
  })
}
