import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import type { Article } from '../types/article'
import { KnowledgeBasePage } from './KnowledgeBasePage'

// The knowledge base is public — it reads through the knowledgeApi service, not
// the authenticated Dataverse client. Mock the service to drive the page.
const { listArticles, getArticle } = vi.hoisted(() => ({
  listArticles: vi.fn(),
  getArticle: vi.fn(),
}))
vi.mock('../services/knowledgeApi', () => ({ listArticles, getArticle }))

function makeArticle(over: Partial<Article> = {}): Article {
  return {
    knowledgearticleid: 'kb1',
    title: 'How to reset your password',
    description: 'A short guide to resetting credentials.',
    articlepublicnumber: 'KB-100',
    modifiedon: '2026-07-01T09:00:00Z',
    ...(over as Article),
  } as Article
}

describe('KnowledgeBasePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const user = () => userEvent.setup()

  it('shows the loading skeleton while articles load', () => {
    listArticles.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<KnowledgeBasePage />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('renders published articles with number and title', async () => {
    listArticles.mockResolvedValue([
      makeArticle(),
      makeArticle({ knowledgearticleid: 'kb2', title: 'VPN setup', articlepublicnumber: 'KB-200', description: 'Connect from home.' }),
    ])
    renderWithProviders(<KnowledgeBasePage />)

    expect(await screen.findByText('How to reset your password')).toBeInTheDocument()
    expect(screen.getByText('A short guide to resetting credentials.')).toBeInTheDocument()
    expect(screen.getByText(/KB-100/)).toBeInTheDocument()
    expect(screen.getByText('VPN setup')).toBeInTheDocument()
  })

  it('links each article to its detail route', async () => {
    listArticles.mockResolvedValue([makeArticle()])
    renderWithProviders(<KnowledgeBasePage />)
    const link = await screen.findByRole('link', { name: /How to reset your password/ })
    expect(link).toHaveAttribute('href', '/knowledge/kb1')
  })

  it('falls back to "Untitled article" when a title is missing', async () => {
    listArticles.mockResolvedValue([makeArticle({ title: '' })])
    renderWithProviders(<KnowledgeBasePage />)
    expect(await screen.findByText('Untitled article')).toBeInTheDocument()
  })

  it('shows the empty message when nothing is published', async () => {
    listArticles.mockResolvedValue([])
    renderWithProviders(<KnowledgeBasePage />)
    expect(await screen.findByText('No articles published yet.')).toBeInTheDocument()
  })

  it('surfaces the query error message', async () => {
    listArticles.mockRejectedValue(new Error('KB offline'))
    renderWithProviders(<KnowledgeBasePage />)
    expect(await screen.findByText('KB offline')).toBeInTheDocument()
  })

  it('filters the list by the search term (title and description)', async () => {
    listArticles.mockResolvedValue([
      makeArticle({ knowledgearticleid: 'kb1', title: 'Password reset', description: 'credentials' }),
      makeArticle({ knowledgearticleid: 'kb2', title: 'VPN setup', description: 'network access' }),
    ])
    renderWithProviders(<KnowledgeBasePage />)
    await screen.findByText('Password reset')

    await user().type(screen.getByLabelText('Search articles'), 'vpn')

    expect(await screen.findByText('VPN setup')).toBeInTheDocument()
    expect(screen.queryByText('Password reset')).not.toBeInTheDocument()
  })

  it('shows the no-match message when the search matches nothing', async () => {
    listArticles.mockResolvedValue([makeArticle({ title: 'Password reset' })])
    renderWithProviders(<KnowledgeBasePage />)
    await screen.findByText('Password reset')

    await user().type(screen.getByLabelText('Search articles'), 'zzzznomatch')

    expect(await screen.findByText('No articles match your search.')).toBeInTheDocument()
  })

  it('matches articles that have no description without throwing', async () => {
    listArticles.mockResolvedValue([makeArticle({ description: undefined, title: 'Only a title here' })])
    renderWithProviders(<KnowledgeBasePage />)
    await screen.findByText('Only a title here')

    await user().type(screen.getByLabelText('Search articles'), 'title')
    expect(await screen.findByText('Only a title here')).toBeInTheDocument()
  })
})

// The knowledgeApi service itself calls a bare global fetch. Cover the error
// branch with the real module + a stubbed fetch (no service mock here).
describe('knowledgeApi service (real, fetch stubbed)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws a descriptive error when the public request is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const actual = await vi.importActual<typeof import('../services/knowledgeApi')>(
      '../services/knowledgeApi',
    )
    await expect(actual.listArticles()).rejects.toThrow(/Knowledge base request failed \(503\)/)
  })

  it('returns the article data array on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ knowledgearticleid: 'x' }] }) }),
    )
    const actual = await vi.importActual<typeof import('../services/knowledgeApi')>(
      '../services/knowledgeApi',
    )
    await expect(actual.listArticles()).resolves.toEqual([{ knowledgearticleid: 'x' }])
  })
})
