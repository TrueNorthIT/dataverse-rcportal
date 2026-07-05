import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import type { Article } from '../types/article'
import { ArticleDetailPage } from './ArticleDetailPage'
import { getArticle } from '../services/knowledgeApi'

// The KB detail page reads via the knowledgeApi service (bare fetch), not the
// SDK client — so we mock the service directly.
vi.mock('../services/knowledgeApi', () => ({
  getArticle: vi.fn(),
  listArticles: vi.fn(),
}))
const mockedGetArticle = vi.mocked(getArticle)

const FIXED_NOW = '2026-07-05T12:00:00Z'

function makeArticle(over: Partial<Article> = {}): Article {
  return {
    knowledgearticleid: 'a1',
    title: 'Resetting your VPN',
    articlepublicnumber: 'KA-0001',
    content: '<p>Click <b>reset</b> and wait.</p>',
    modifiedon: '2026-07-02T09:00:00Z',
    ...over,
  }
}

function renderPage(route = '/knowledge/a1') {
  return renderWithProviders(<ArticleDetailPage />, { path: '/knowledge/:id', route })
}

describe('ArticleDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fake only the clock so formatDate is deterministic — keep real timers so
    // findBy*/waitFor polling still fires.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FIXED_NOW))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton while the article loads', () => {
    mockedGetArticle.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelector('.rc-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Resetting your VPN' })).not.toBeInTheDocument()
  })

  it('renders the article title, public number and sanitised content', async () => {
    mockedGetArticle.mockResolvedValue(makeArticle())
    const { container } = renderPage()

    expect(await screen.findByRole('heading', { name: 'Resetting your VPN' })).toBeInTheDocument()
    expect(screen.getByText(/KA-0001 ·/)).toBeInTheDocument()
    // Sanitised HTML is rendered — the bold node survives.
    expect(container.querySelector('b')).toHaveTextContent('reset')
    expect(mockedGetArticle).toHaveBeenCalledWith('a1')
  })

  it('falls back to "Article" when the record has no title', async () => {
    mockedGetArticle.mockResolvedValue(makeArticle({ title: '' }))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Article' })).toBeInTheDocument()
  })

  it('omits the public number prefix when absent', async () => {
    mockedGetArticle.mockResolvedValue(makeArticle({ articlepublicnumber: '' }))
    renderPage()
    await screen.findByRole('heading', { name: 'Resetting your VPN' })
    expect(screen.queryByText(/KA-0001/)).not.toBeInTheDocument()
    expect(screen.getByText(/^Updated/)).toBeInTheDocument()
  })

  it('strips dangerous markup before rendering (real DOMPurify)', async () => {
    mockedGetArticle.mockResolvedValue(
      makeArticle({ content: '<p>Safe copy.</p><script>window.__pwned = 1</script>' }),
    )
    const { container } = renderPage()
    await screen.findByRole('heading', { name: 'Resetting your VPN' })
    expect(screen.getByText('Safe copy.')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })

  it('handles an article with no content without crashing', async () => {
    mockedGetArticle.mockResolvedValue(makeArticle({ content: undefined }))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Resetting your VPN' })).toBeInTheDocument()
  })

  it('shows the error message when the article fails to load', async () => {
    mockedGetArticle.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText('Couldn’t load this article.')).toBeInTheDocument()
  })

  it('navigates back to the knowledge base on the back button', async () => {
    const user = userEvent.setup()
    mockedGetArticle.mockResolvedValue(makeArticle())
    renderPage()
    await screen.findByRole('heading', { name: 'Resetting your VPN' })
    // Clicking should not throw — router accepts the navigate('/knowledge').
    await user.click(screen.getByRole('button', { name: /Knowledge base/ }))
  })
})

// One test that drives the REAL knowledgeApi service against a stubbed global
// fetch, covering the service's !res.ok error branch (the page mock bypasses it).
describe('knowledgeApi.getArticle (service integration)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('throws a descriptive error when the fetch is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    // Import the real module (bypassing the page-level vi.mock via unmock).
    const actual = await vi.importActual<typeof import('../services/knowledgeApi')>(
      '../services/knowledgeApi',
    )
    await expect(actual.getArticle('a1')).rejects.toThrow(/failed \(503\)/)
  })

  it('returns the parsed article on a successful fetch', async () => {
    const article = makeArticle()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: article }) }),
    )
    const actual = await vi.importActual<typeof import('../services/knowledgeApi')>(
      '../services/knowledgeApi',
    )
    await expect(actual.getArticle('a1')).resolves.toEqual(article)
  })
})
