import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { POST as postChapter } from './[id]/chapter/route'
import { POST as postSendToAds } from './[id]/send-to-ads/route'
import { prisma } from '@/lib/db'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_test_123'),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    bookCreatorProject: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn(),
    },
    book: {
      create: vi.fn(),
    },
  },
}))

describe('Book Creator API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/creator/projects returns projects for publisher', async () => {
    vi.mocked(prisma.bookCreatorProject.findMany).mockResolvedValueOnce([
      { id: 'proj_1', title: 'Test Book', bookType: 'children' } as any,
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.projects).toHaveLength(1)
    expect(json.projects[0].id).toBe('proj_1')
  })

  it('POST /api/creator/projects rejects invalid input', async () => {
    const req = new Request('http://localhost/api/creator/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST /api/creator/projects creates a children book project', async () => {
    vi.mocked(prisma.bookCreatorProject.create).mockResolvedValueOnce({
      id: 'proj_children_1',
      title: 'Barnaby Bear',
      bookType: 'children',
      status: 'generated',
    } as any)

    const req = new Request('http://localhost/api/creator/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Barnaby Bear',
        bookType: 'children',
        promptConcept: 'A curious bear discovers a falling star in the forest.',
        styleTheme: 'watercolor',
        targetAudience: 'early_readers',
        pageCount: 6,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('proj_children_1')
    expect(prisma.bookCreatorProject.create).toHaveBeenCalled()
  })

  it('POST /api/creator/projects/[id]/chapter writes a draft chapter', async () => {
    const mockProject = {
      id: 'proj_novel_1',
      publisherId: 'pub_test_123',
      title: 'Venetian Clockwork',
      bookType: 'novel_chapter',
      styleTheme: 'thriller_suspense',
      content: {
        type: 'novel_chapter',
        novel: {
          premise: 'Venice 1892 conspiracy',
          chapters: [
            {
              chapterNumber: 1,
              title: 'The Brass Key',
              summary: 'Alden opens his workshop.',
              status: 'draft',
              content: '',
              wordCount: 0,
            },
          ],
        },
      },
    }

    vi.mocked(prisma.bookCreatorProject.findFirst).mockResolvedValue(mockProject as any)
    vi.mocked(prisma.bookCreatorProject.update).mockResolvedValueOnce({
      ...mockProject,
      wordCount: 1100,
    } as any)

    const req = new Request('http://localhost/api/creator/projects/proj_novel_1/chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterNumber: 1 }),
    })

    const params = Promise.resolve({ id: 'proj_novel_1' })
    const res = await postChapter(req, { params })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.chapter.content).not.toBe('')
    expect(json.chapter.wordCount).toBeGreaterThan(0)

    // No AI key is configured in tests, so this is placeholder text. It must
    // stay a draft and say so, rather than being reported as written.
    expect(json.source).toBe('fallback')
    expect(json.chapter.status).toBe('draft')
  })

  it('POST /api/creator/projects/[id]/send-to-ads bridges book into ads studio', async () => {
    const mockProject = {
      id: 'proj_to_bridge',
      publisherId: 'pub_test_123',
      title: 'Illustrated Dragon Tale',
      author: 'Maya Lin',
      promptConcept: 'Bedtime story with friendly dragon.',
      coverImageUrl: null,
      content: {
        type: 'children',
        pages: [],
      },
    }

    vi.mocked(prisma.bookCreatorProject.findFirst).mockResolvedValueOnce(mockProject as any)
    vi.mocked(prisma.book.create).mockResolvedValueOnce({
      id: 'ads_book_new_1',
      title: 'Illustrated Dragon Tale',
    } as any)

    const req = new Request('http://localhost/api/creator/projects/proj_to_bridge/send-to-ads', {
      method: 'POST',
    })

    const params = Promise.resolve({ id: 'proj_to_bridge' })
    const res = await postSendToAds(req, { params })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.adsProjectId).toBe('ads_book_new_1')
    expect(json.redirectUrl).toBe('/ads/ads_book_new_1/configure')
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Illustrated Dragon Tale',
          author: 'Maya Lin',
          platforms: ['AMAZON'],
        }),
      })
    )
  })
})
