import { prisma } from '@/lib/db'
import type { Book, AdCopy } from '@prisma/client'
import {
  dedupeByTitle,
  LIBRARY_ROW_LIMIT,
  LIBRARY_SELECT,
  type LibraryEntry,
} from '@/lib/services/shared/library'

/** The rail and the hub both show a short recent list, never the whole table. */
export const RAIL_SELECT = {
  id: true,
  title: true,
  status: true,
  frontCoverUrl: true,
  updatedAt: true,
} as const

export type RailBook = Pick<Book, 'id' | 'title' | 'status' | 'frontCoverUrl' | 'updatedAt'>

export function getRecentBooksForPublisher(publisherId: string, take: number): Promise<RailBook[]> {
  return prisma.book.findMany({
    where: { publisherId },
    orderBy: { updatedAt: 'desc' },
    take,
    select: RAIL_SELECT,
  })
}

export function getBookForPublisher(publisherId: string, bookId: string): Promise<Book | null> {
  return prisma.book.findFirst({ where: { id: bookId, publisherId } })
}

export function countBooksForPublisher(publisherId: string): Promise<number> {
  return prisma.book.count({ where: { publisherId } })
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

export async function getPublisherBookLibrary(publisherId: string): Promise<LibraryEntry[]> {
  const rows = await prisma.book.findMany({
    where: { publisherId },
    orderBy: { createdAt: 'desc' },
    take: LIBRARY_ROW_LIMIT,
    select: LIBRARY_SELECT,
  })
  return dedupeByTitle([{ rows, source: 'book' }])
}

export async function getCampaignsForBook(publisherId: string, bookId: string): Promise<Book[]> {
  const target = await prisma.book.findFirst({
    where: { id: bookId, publisherId },
    select: { id: true, parentBookId: true },
  })
  if (!target) return []
  const rootId = target.parentBookId ?? target.id
  return prisma.book.findMany({
    where: { publisherId, OR: [{ id: rootId }, { parentBookId: rootId }] },
    orderBy: { createdAt: 'desc' },
  })
}
