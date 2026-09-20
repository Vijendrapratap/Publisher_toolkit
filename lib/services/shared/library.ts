/**
 * "Pick an existing book" pickers list one entry per *title*, not per project —
 * a publisher who ran four campaigns for one book should see that book once.
 */
export interface LibraryEntry {
  id: string
  title: string
  author: string
  blurb: string
  frontCoverUrl: string | null
  createdAt: Date
  /** How many projects/campaigns collapsed into this entry. */
  campaignCount: number
  source: 'book' | 'trailer'
}

export interface LibraryRow {
  id: string
  title: string | null
  author: string | null
  blurb: string | null
  frontCoverUrl: string | null
  createdAt: Date
}

/** The only columns a picker needs — keeps PDFs and configs off the wire. */
export const LIBRARY_SELECT = {
  id: true,
  title: true,
  author: true,
  blurb: true,
  frontCoverUrl: true,
  createdAt: true,
} as const

/** A picker is not a paginated view; more than this is noise. */
export const LIBRARY_ROW_LIMIT = 200

/**
 * Rows must arrive newest-first: the first row for a title wins the entry's id,
 * so "new campaign from this book" branches off the most recent one.
 */
export function dedupeByTitle(groups: { rows: LibraryRow[]; source: LibraryEntry['source'] }[]): LibraryEntry[] {
  const byTitle = new Map<string, LibraryEntry>()

  for (const { rows, source } of groups) {
    for (const row of rows) {
      const key = (row.title || row.id).trim().toLowerCase()
      const existing = byTitle.get(key)
      if (existing) {
        existing.campaignCount += 1
        existing.frontCoverUrl ??= row.frontCoverUrl
        continue
      }
      byTitle.set(key, {
        id: row.id,
        title: row.title || 'Untitled book',
        author: row.author || '',
        blurb: row.blurb || '',
        frontCoverUrl: row.frontCoverUrl,
        createdAt: row.createdAt,
        campaignCount: 1,
        source,
      })
    }
  }

  return [...byTitle.values()]
}
