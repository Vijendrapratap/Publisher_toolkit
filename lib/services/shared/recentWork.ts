/** One "Pick up where you left off" card on the home page, linked to the tool it belongs to. */
export interface RecentItem {
  key: string
  kind: 'ads' | 'book'
  title: string
  coverUrl: string | null
  href: string
  updatedAt: Date
}

export function mergeRecentWork(
  ads: { id: string; title: string; coverUrl: string | null; activityAt: Date }[],
  books: { id: string; title: string | null; coverImageUrl: string | null; updatedAt: Date | string }[],
  limit: number
): RecentItem[] {
  const items: RecentItem[] = [
    ...ads.map((p) => ({
      key: `ads:${p.id}`,
      kind: 'ads' as const,
      title: p.title,
      coverUrl: p.coverUrl,
      href: `/ads/books/${p.id}`,
      updatedAt: p.activityAt,
    })),
    ...books.map((b) => ({
      key: `book:${b.id}`,
      kind: 'book' as const,
      title: b.title || 'Untitled book',
      coverUrl: b.coverImageUrl,
      href: `/create-book/${b.id}`,
      updatedAt: new Date(b.updatedAt),
    })),
  ]
  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, limit)
}
