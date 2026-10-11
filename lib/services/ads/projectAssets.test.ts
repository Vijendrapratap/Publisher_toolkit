import { describe, it, expect } from 'vitest'
import { groupProjectAssets, summarizeProject, type ProjectRow } from './projectAssets'

const d = (day: number) => new Date(Date.UTC(2026, 9, day))
const APLUS = 'amazon_aplus_banner_970x600'
const SPONSORED = 'amazon_300x250'

function row(over: Partial<ProjectRow> & { id: string }): ProjectRow {
  return { contentGoal: null, createdAt: d(1), set: null, aiVideo: null, ...over }
}
function set(day: number, images: [string, string][], video?: { url: string; poster?: string; duration?: number }) {
  return {
    createdAt: d(day),
    videoUrl: video?.url ?? null,
    videoPosterUrl: video?.poster ?? null,
    videoDuration: video?.duration ?? null,
    images: images.map(([sizeKey, imageUrl]) => ({ sizeKey, imageUrl })),
  }
}

describe('groupProjectAssets', () => {
  it('puts each creation in its own row and keeps the newest as latest', () => {
    const groups = groupProjectAssets([
      row({ id: 'a1', contentGoal: 'aplus', createdAt: d(2), set: set(2, [[APLUS, 'old.png']]) }),
      row({ id: 'a2', contentGoal: 'aplus', createdAt: d(5), set: set(5, [[APLUS, 'new.png']]) }),
      row({ id: 's1', contentGoal: 'sponsored', createdAt: d(3), set: set(3, [[SPONSORED, 'ad.png']]) }),
    ])
    expect(groups.aplus.latest?.rowId).toBe('a2')
    expect(groups.aplus.latest?.imageUrls).toEqual(['new.png'])
    expect(groups.aplus.earlier.map((v) => v.rowId)).toEqual(['a1'])
    expect(groups.sponsored.latest?.imageUrls).toEqual(['ad.png'])
    expect(groups.video.latest).toBeNull()
  })

  it('splits a legacy all-in-one set across the rows by what it contains', () => {
    const groups = groupProjectAssets([
      row({
        id: 'root',
        contentGoal: 'all',
        set: set(4, [[APLUS, 'hero.png'], [SPONSORED, 'banner.png']], { url: 'v.mp4', poster: 'p.png', duration: 15 }),
      }),
    ])
    expect(groups.aplus.latest?.imageUrls).toEqual(['hero.png'])
    expect(groups.sponsored.latest?.imageUrls).toEqual(['banner.png'])
    expect(groups.video.latest).toMatchObject({ rowId: 'root', videoUrl: 'v.mp4', posterUrl: 'p.png', durationSec: 15 })
  })

  it('treats a NULL goal like a legacy bundle', () => {
    const groups = groupProjectAssets([row({ id: 'r', contentGoal: null, set: set(1, [[SPONSORED, 'x.png']]) })])
    expect(groups.sponsored.latest?.rowId).toBe('r')
  })

  it('does not leak an explicit goal row into other rows', () => {
    const groups = groupProjectAssets([
      row({ id: 's', contentGoal: 'sponsored', set: set(1, [[SPONSORED, 'x.png'], [APLUS, 'stray.png']]) }),
    ])
    expect(groups.aplus.latest).toBeNull()
  })

  it('counts a finished AI video when the set has none, and prefers the newer video', () => {
    const groups = groupProjectAssets([
      row({ id: 'v1', contentGoal: 'video', set: set(1, []), aiVideo: { videoUrl: 'ai.mp4', posterUrl: 'ai.png', createdAt: d(2) } }),
      row({
        id: 'v2',
        contentGoal: 'video',
        createdAt: d(3),
        set: set(3, [], { url: 'instant.mp4' }),
        aiVideo: { videoUrl: 'ai2.mp4', posterUrl: null, createdAt: d(6) },
      }),
    ])
    expect(groups.video.latest).toMatchObject({ rowId: 'v2', videoUrl: 'ai2.mp4' })
    expect(groups.video.earlier[0]).toMatchObject({ rowId: 'v1', videoUrl: 'ai.mp4', posterUrl: 'ai.png' })
  })

  it('reports the newest unfinished creation as a draft only when it is newer than the latest version', () => {
    const groups = groupProjectAssets([
      row({ id: 'oldDraft', contentGoal: 'aplus', createdAt: d(1) }),
      row({ id: 'done', contentGoal: 'aplus', createdAt: d(2), set: set(2, [[APLUS, 'a.png']]) }),
      row({ id: 'newDraft', contentGoal: 'aplus', createdAt: d(3) }),
      row({ id: 'vDraft', contentGoal: 'video', createdAt: d(1) }),
    ])
    expect(groups.aplus.draftRowId).toBe('newDraft')
    expect(groups.video.draftRowId).toBe('vDraft')
    expect(groups.sponsored.draftRowId).toBeNull()
  })

  it('never reports a legacy bundle row as a draft', () => {
    const groups = groupProjectAssets([row({ id: 'root', contentGoal: 'all' })])
    expect(groups.aplus.draftRowId).toBeNull()
    expect(groups.video.draftRowId).toBeNull()
    expect(groups.sponsored.draftRowId).toBeNull()
  })
})

describe('summarizeProject', () => {
  it('lists what exists, in row order', () => {
    const groups = groupProjectAssets([
      row({ id: 's', contentGoal: 'sponsored', set: set(1, [[SPONSORED, 'x.png']]) }),
      row({ id: 'a', contentGoal: 'aplus', set: set(1, [[APLUS, 'y.png']]) }),
    ])
    expect(summarizeProject(groups)).toBe('A+ images · Ad images')
  })

  it('says when nothing has been made', () => {
    expect(summarizeProject(groupProjectAssets([]))).toBe('Nothing made yet')
  })
})
