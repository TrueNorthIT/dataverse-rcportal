import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, paginated, count, type MockClient } from '../test/dataverse'
import type { Quote } from '../types/quote'
import { QuotesPage } from './QuotesPage'

const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({
    selectedCompanyId: undefined,
    allCompanies: false,
    companies: [],
    hasMultiple: false,
    loading: false,
  }),
}))
vi.mock('../hooks/useCompanyClients', () => ({ useCompanyClients: () => [] }))

/** A quote row with sensible defaults; override only what a test cares about. */
function makeQuote(over: Partial<Quote> = {}): Quote {
  return {
    quoteid: 'q1',
    name: 'Firewall upgrade',
    description: 'New edge firewalls',
    quotenumber: 'QUO-1001',
    totalamount: 125000,
    createdon: '2026-05-01T00:00:00Z',
    statecode_label: 'Active',
    ...over,
  }
}

describe('QuotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    client.team.aggregate.mockResolvedValue(count(3))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton on first render', () => {
    client.team.list.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<QuotesPage />)

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quotes' })).toBeInTheDocument()
    expect(screen.getByText("Your company's quotes")).toBeInTheDocument()
  })

  it('renders the empty message when there are no quotes', async () => {
    client.team.list.mockResolvedValue(paginated<Quote>([]))
    renderWithProviders(<QuotesPage />)

    expect(await screen.findByText('No quotes to show yet.')).toBeInTheDocument()
  })

  it('surfaces the error banner when the list request fails', async () => {
    client.team.list.mockRejectedValue(new Error('Quotes unavailable'))
    renderWithProviders(<QuotesPage />)

    expect(await screen.findByText('Quotes unavailable')).toBeInTheDocument()
  })

  it('lists quotes with name, number, currency total and status chip', async () => {
    client.team.list.mockResolvedValue(
      paginated<Quote>([
        makeQuote({
          name: 'Firewall upgrade',
          description: '[DEMO-RCPORTAL]New edge firewalls',
          quotenumber: 'QUO-1001',
          totalamount: 125000,
          statecode_label: 'Active',
        }),
      ]),
    )
    renderWithProviders(<QuotesPage />)

    await screen.findByText('Firewall upgrade')
    const row = screen.getByRole('button', { name: /Firewall upgrade/ })
    // Cleaned description (marker stripped).
    expect(within(row).getByText('New edge firewalls')).toBeInTheDocument()
    // Quote number + date line.
    expect(within(row).getByText(/QUO-1001 · 1 May 2026/)).toBeInTheDocument()
    // GBP currency formatting, no decimals.
    expect(within(row).getByText('£125,000')).toBeInTheDocument()
    // "Active" is also a filter pill; assert the status chip within the row.
    expect(within(row).getByText('Active')).toBeInTheDocument()
  })

  it('falls back to the quote number, then "Quote", when unnamed', async () => {
    client.team.list.mockResolvedValue(
      paginated<Quote>([
        makeQuote({ quoteid: 'q1', name: undefined, quotenumber: 'QUO-2002' }),
        makeQuote({ quoteid: 'q2', name: undefined, quotenumber: undefined }),
      ]),
    )
    renderWithProviders(<QuotesPage />)

    // First card uses the quote number as its title.
    expect(await screen.findByRole('button', { name: /QUO-2002/ })).toBeInTheDocument()
    // Second card has neither name nor number → literal "Quote" title.
    expect(screen.getByRole('button', { name: /^Quote/ })).toBeInTheDocument()
  })

  it('shows an em dash for a quote with no total', async () => {
    client.team.list.mockResolvedValue(
      paginated<Quote>([makeQuote({ totalamount: undefined })]),
    )
    renderWithProviders(<QuotesPage />)

    await screen.findByText('Firewall upgrade')
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('navigates to the quote detail on row click', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(
      paginated<Quote>([
        makeQuote({ quoteid: 'q1', name: 'Alpha quote' }),
        makeQuote({ quoteid: 'q2', name: 'Beta quote' }),
      ]),
    )
    renderWithProviders(<QuotesPage />, { path: '/quotes', route: '/quotes' })

    await user.click(await screen.findByText('Alpha quote'))
    await waitFor(() => expect(screen.queryByText('Beta quote')).not.toBeInTheDocument())
  })

  it('switches to the My tier and refetches from the me scope', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(paginated<Quote>([makeQuote({ name: 'Company quote' })]))
    client.me.list.mockResolvedValue(
      paginated<Quote>([makeQuote({ quoteid: 'm1', name: 'My quote' })]),
    )
    client.me.aggregate.mockResolvedValue(count(2))
    renderWithProviders(<QuotesPage />)

    await screen.findByText('Company quote')
    await user.click(screen.getByRole('tab', { name: 'My' }))

    expect(await screen.findByText('My quote')).toBeInTheDocument()
    expect(screen.getByText('Your quotes')).toBeInTheDocument()
    expect(client.me.list).toHaveBeenCalled()
  })

  it('re-queries with the status filter when a filter pill is chosen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(paginated<Quote>([makeQuote()]))
    renderWithProviders(<QuotesPage />)

    await screen.findByText('Firewall upgrade')
    const draftPill = screen.getByRole('button', { name: 'Draft' })
    await user.click(draftPill)

    await waitFor(() =>
      expect(client.team.list).toHaveBeenCalledWith(
        'quote',
        expect.objectContaining({ filter: expect.anything() }),
      ),
    )
    expect(draftPill).toHaveAttribute('aria-pressed', 'true')
  })

  it('re-sorts when a sort option is chosen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(paginated<Quote>([makeQuote()]))
    renderWithProviders(<QuotesPage />)

    await screen.findByText('Firewall upgrade')
    const sortGroup = screen.getByRole('group', { name: 'Sort by' })
    await user.click(within(sortGroup).getByRole('button', { name: 'Value (high–low)' }))

    await waitFor(() =>
      expect(client.team.list).toHaveBeenCalledWith(
        'quote',
        expect.objectContaining({ orderBy: { field: 'totalamount', direction: 'desc' } }),
      ),
    )
  })

  it('disables pills whose count is zero', async () => {
    client.team.list.mockResolvedValue(paginated<Quote>([makeQuote()]))
    client.team.aggregate.mockResolvedValue(count(0))
    renderWithProviders(<QuotesPage />)

    await screen.findByText('Firewall upgrade')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Draft' })).toBeDisabled())
  })

  it('resets a disabled active filter back to All (from a deep link)', async () => {
    client.team.list.mockResolvedValue(paginated<Quote>([makeQuote()]))
    client.team.aggregate.mockResolvedValue(count(0))
    renderWithProviders(<QuotesPage />, { route: '/quotes?f=draft' })

    await screen.findByText('Firewall upgrade')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true'),
    )
  })

  it('loads the next page when the load-more sentinel scrolls into view', async () => {
    let ioCallback: IntersectionObserverCallback | undefined
    const observe = vi.fn()
    class CapturingIO {
      constructor(cb: IntersectionObserverCallback) {
        ioCallback = cb
      }
      observe = observe
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = ''
      thresholds = []
    }
    vi.stubGlobal('IntersectionObserver', CapturingIO)

    client.team.list.mockResolvedValue(
      paginated<Quote>([makeQuote({ quoteid: 'q1', name: 'Page one' })], 'next-url'),
    )
    client.team.fetchPage.mockResolvedValue(
      paginated<Quote>([makeQuote({ quoteid: 'q2', name: 'Page two' })]),
    )
    renderWithProviders(<QuotesPage />)

    await screen.findByText('Page one')
    await waitFor(() => expect(observe).toHaveBeenCalled())

    ioCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )

    expect(await screen.findByText('Page two')).toBeInTheDocument()
    expect(client.team.fetchPage).toHaveBeenCalledWith('next-url')
  })
})
