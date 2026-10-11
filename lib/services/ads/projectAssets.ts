import { CREATIVE_SIZES } from './sizes'

// A book's Ads project is its root Book row plus one child row per creation.
// This turns those rows into the three things a person can make.

export type AssetKind = 'aplus' | 'video' | 'sponsored'

export const ASSET_KINDS: AssetKind[] = ['aplus', 'video', 'sponsored']

export const ASSET_LABELS: Record<AssetKind, string> = {
  aplus: 'A+ images for Amazon',
  video: 'Video ad',
  sponsored: 'Ad images',
}

const SHORT_LABELS: Record<AssetKind, string> = { aplus: 'A+ images', video: 'Video', sponsored: 'Ad images' }

export interface ProjectRow {
  id: string
  contentGoal: string | null
  createdAt: Date
  /** Latest CreativeSet of this row. */
  set: {
    createdAt: Date
    videoUrl: string | null
    videoPosterUrl: string | null
    videoDuration: number | null
    images: { imageUrl: string; sizeKey: string }[]
  } | null
  /** Latest completed AiVideoJob of this row. */
  aiVideo: { videoUrl: string | null; posterUrl: string | null; createdAt: Date } | null
}

export interface AssetVersion {
  rowId: string
  createdAt: Date
  imageUrls: string[]
  videoUrl: string | null
  posterUrl: string | null
  durationSec: number | null
}

export interface AssetGroup {
  latest: AssetVersion | null
  earlier: AssetVersion[]
  /** Newest creation of this kind that has no output yet and is newer than `latest`. */
  draftRowId: string | null
}

// Sizes without a category (old Meta/Google sizes) are ad images.
const SIZE_KIND = new Map<string, AssetKind>(CREATIVE_SIZES.map((s) => [s.key, s.category ?? 'sponsored']))

function isKind(goal: string | null): goal is AssetKind {
  return goal === 'aplus' || goal === 'video' || goal === 'sponsored'
}

const newestFirst = <T extends { createdAt: Date }>(a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime()

function versionFor(row: ProjectRow, kind: AssetKind): AssetVersion | null {
  if (kind === 'video') {
    const candidates: AssetVersion[] = []
    if (row.set?.videoUrl) {
      candidates.push({
        rowId: row.id,
        createdAt: row.set.createdAt,
        imageUrls: [],
        videoUrl: row.set.videoUrl,
        posterUrl: row.set.videoPosterUrl,
        durationSec: row.set.videoDuration,
      })
    }
    if (row.aiVideo?.videoUrl) {
      candidates.push({
        rowId: row.id,
        createdAt: row.aiVideo.createdAt,
        imageUrls: [],
        videoUrl: row.aiVideo.videoUrl,
        posterUrl: row.aiVideo.posterUrl,
        durationSec: null,
      })
    }
    return candidates.sort(newestFirst)[0] ?? null
  }
  const imageUrls = (row.set?.images ?? [])
    .filter((i) => (SIZE_KIND.get(i.sizeKey) ?? 'sponsored') === kind)
    .map((i) => i.imageUrl)
  if (!row.set || imageUrls.length === 0) return null
  return { rowId: row.id, createdAt: row.set.createdAt, imageUrls, videoUrl: null, posterUrl: null, durationSec: null }
}

export function groupProjectAssets(rows: ProjectRow[]): Record<AssetKind, AssetGroup> {
  const groups = {} as Record<AssetKind, AssetGroup>
  for (const kind of ASSET_KINDS) {
    // Explicit-goal rows belong to one kind; legacy bundle rows (all / NULL) to any kind they contain.
    const candidates = rows.filter((r) => !isKind(r.contentGoal) || r.contentGoal === kind)
    const versions = candidates
      .map((r) => versionFor(r, kind))
      .filter((v): v is AssetVersion => v !== null)
      .sort(newestFirst)
    const latest = versions[0] ?? null
    const draft = rows
      .filter((r) => r.contentGoal === kind && versionFor(r, kind) === null)
      .filter((r) => !latest || r.createdAt > latest.createdAt)
      .sort(newestFirst)[0]
    groups[kind] = { latest, earlier: versions.slice(1), draftRowId: draft?.id ?? null }
  }
  return groups
}

export function summarizeProject(groups: Record<AssetKind, AssetGroup>): string {
  const made = ASSET_KINDS.filter((k) => groups[k].latest).map((k) => SHORT_LABELS[k])
  return made.length > 0 ? made.join(' · ') : 'Nothing made yet'
}
