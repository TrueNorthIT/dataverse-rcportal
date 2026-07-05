import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article } from '../types/article'
import { listArticles, getArticle } from './knowledgeApi'

// apiBaseUrl derives from VITE_API_BASE_URL (test env) → this exact origin/path.
const BASE = 'https://api.test.local/api/v2/rcportal'

/** Build a Response-like object good enough for the service's `res.ok`/`res.json`. */
function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('knowledgeApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('listArticles', () => {
    it('fetches published articles from the public tier and unwraps `.data`', async () => {
      const articles: Article[] = [
        { knowledgearticleid: 'a1', title: 'Reset password' },
        { knowledgearticleid: 'a2', title: 'VPN setup' },
      ]
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: articles }))
      vi.stubGlobal('fetch', fetchMock)

      const result = await listArticles()

      expect(result).toEqual(articles)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toContain(`${BASE}/public/knowledgearticle?`)
      expect(url).toContain('orderBy=title%3Aasc')
      expect(url).toContain('top=100')
      expect(url).toContain('select=')
      expect(init).toEqual({ headers: { Accept: 'application/json' } })
    })

    it('returns an empty array when the payload carries no data', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))

      const result = await listArticles()

      expect(result).toEqual([])
    })

    it('throws with the status code when the response is not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 503 })),
      )

      await expect(listArticles()).rejects.toThrow('Knowledge base request failed (503)')
    })
  })

  describe('getArticle', () => {
    it('fetches a single article by id with the detail columns', async () => {
      const article: Article = { knowledgearticleid: 'a1', title: 'Reset password', content: '<p>Hi</p>' }
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: article }))
      vi.stubGlobal('fetch', fetchMock)

      const result = await getArticle('a1')

      expect(result).toEqual(article)
      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain(`${BASE}/public/knowledgearticle/a1?`)
      expect(url).toContain('select=')
      // detail select includes the rich `content` + `keywords` columns
      expect(decodeURIComponent(url)).toContain('content')
      expect(decodeURIComponent(url)).toContain('keywords')
    })

    it('propagates a not-ok error (covers the shared !res.ok branch)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 404 })),
      )

      await expect(getArticle('missing')).rejects.toThrow('Knowledge base request failed (404)')
    })

    it('hits the real global fetch path (stubbed) exercising publicGet end-to-end', async () => {
      // A distinct test that stubs the true global fetch symbol to confirm the
      // service reaches for `fetch` rather than any injected client.
      const spy = vi.fn().mockResolvedValue(jsonResponse({ data: { knowledgearticleid: 'z' } }))
      vi.stubGlobal('fetch', spy)

      await getArticle('z')

      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
})
