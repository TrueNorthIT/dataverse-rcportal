import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, single, paginated, type MockClient } from '../test/dataverse'
import type { Quote, QuoteLine } from '../types/quote'
import type { Opportunity } from '../types/dataverse.generated'
import { QuoteDetailPage } from './QuoteDetailPage'

const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client, publicClient: () => client }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({
    selectedCompanyId: undefined,
    allCompanies: false,
    companies: [],
    hasMultiple: false,
    loading: false,
  }),
}))

const NOW = '2026-07-05T12:00:00Z'

function makeQuote(over: Partial<Quote> = {}): Quote {
  return {
    quoteid: 'q1',
    name: 'Managed Firewall Renewal',
    quotenumber: 'QUO-1001',
    totalamount: 1000,
    statecode_label: 'Active',
    effectivefrom: '2026-01-01T00:00:00Z',
    effectiveto: '2026-12-31T00:00:00Z',
    createdon: '2025-12-01T00:00:00Z',
    description: 'Annual managed firewall renewal.',
    ...over,
  }
}

function renderPage(opts: { route?: string; state?: unknown } = {}) {
  return renderWithProviders(<QuoteDetailPage />, {
    path: '/quotes/:id',
    route: opts.route ?? '/quotes/q1',
    state: opts.state,
  })
}

describe('QuoteDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // shouldAdvanceTime keeps real time flowing (so React Query + waitFor still
    // work) while Date.now() reports the fixed instant used for date formatting.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(NOW))
    // Default: no line items unless a test opts in.
    client.me.list.mockResolvedValue(paginated<QuoteLine>([]))
    client.team.list.mockResolvedValue(paginated<QuoteLine>([]))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton while the quote is fetching', () => {
    client.me.get.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelector('.rc-skeleton')).not.toBeNull()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders an error message when the fetch rejects on both tiers', async () => {
    client.me.get.mockRejectedValue(new Error('me denied'))
    client.team.get.mockRejectedValue(new Error('quote not found'))
    renderPage()
    expect(await screen.findByText('quote not found')).toBeInTheDocument()
  })

  it('renders the header, status chip and meta grid on success', async () => {
    client.me.get.mockResolvedValue(single(makeQuote()))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Managed Firewall Renewal' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('QUO-1001')).toBeInTheDocument()
    expect(screen.getByText('£1,000')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Annual managed firewall renewal.')).toBeInTheDocument()
  })

  it('falls back to the quote number, then "Quote", when name is empty', async () => {
    client.me.get.mockResolvedValue(single(makeQuote({ name: '', quotenumber: 'QUO-2002' })))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'QUO-2002' })).toBeInTheDocument()
  })

  it('falls all the way back to "Quote" when both name and number are empty', async () => {
    client.me.get.mockResolvedValue(single(makeQuote({ name: '', quotenumber: '' })))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Quote' })).toBeInTheDocument()
  })

  it('shows "Opportunity" as the source label when the opportunity has no name', async () => {
    client.me.get.mockImplementation((table: string) => {
      if (table === 'opportunity') {
        return Promise.resolve(single<Opportunity>({ opportunityid: 'opp1', estimatedvalue: 7500 }))
      }
      return Promise.resolve(single(makeQuote({ _opportunityid_value: 'opp1' })))
    })
    renderPage()
    expect(await screen.findByText('Opportunity')).toBeInTheDocument()
    expect(screen.getByText('£7,500')).toBeInTheDocument()
  })

  it('omits the notes block when there is no description', async () => {
    client.me.get.mockResolvedValue(single(makeQuote({ description: '' })))
    renderPage()
    await screen.findByRole('heading', { name: 'Managed Firewall Renewal' })
    expect(screen.queryByText('Notes')).not.toBeInTheDocument()
  })

  it('shows the empty-state card when the quote has no line items', async () => {
    client.me.get.mockResolvedValue(single(makeQuote()))
    renderPage()
    expect(await screen.findByText('No line items on this quote.')).toBeInTheDocument()
  })

  it('renders line items and computes subtotal, VAT and gross totals', async () => {
    client.me.get.mockResolvedValue(single(makeQuote()))
    client.me.list.mockResolvedValue(
      paginated<QuoteLine>([
        {
          quotedetailid: 'l1',
          productdescription: 'Firewall appliance',
          priceperunit: 500,
          quantity: 2,
          extendedamount: 1000,
        },
        {
          quotedetailid: 'l2',
          productdescription: 'Support (12 mo)',
          priceperunit: 500,
          quantity: 1,
          extendedamount: 500,
        },
      ]),
    )
    renderPage()

    expect(await screen.findByText('Firewall appliance')).toBeInTheDocument()
    expect(screen.getByText('Support (12 mo)')).toBeInTheDocument()
    // Per-line "£unit × qty" descriptor.
    expect(screen.getByText('£500 × 2')).toBeInTheDocument()
    // Subtotal 1500, VAT 300, gross 1800.
    expect(screen.getByText('£1,500')).toBeInTheDocument()
    expect(screen.getByText('£300')).toBeInTheDocument()
    expect(screen.getByText('£1,800')).toBeInTheDocument()
    // Line-items section title carries the count.
    expect(screen.getByText('(2)')).toBeInTheDocument()
  })

  it('falls back to "Item" and a quantity of 1 for a bare line', async () => {
    client.me.get.mockResolvedValue(single(makeQuote()))
    client.me.list.mockResolvedValue(
      paginated<QuoteLine>([
        { quotedetailid: 'l1', priceperunit: 250, extendedamount: 250 },
      ]),
    )
    renderPage()
    expect(await screen.findByText('Item')).toBeInTheDocument()
    expect(screen.getByText('£250 × 1')).toBeInTheDocument()
  })

  it('derives the subtotal from totalamount when there are no lines', async () => {
    client.me.get.mockResolvedValue(single(makeQuote({ totalamount: 2000 })))
    renderPage()
    // Empty lines → subtotal falls back to totalamount (2000); this shows in the
    // header meta as the ex-VAT value.
    expect(await screen.findByText('£2,000')).toBeInTheDocument()
  })

  it('renders the source-opportunity card when the quote links an opportunity', async () => {
    client.me.get.mockResolvedValue(single(makeQuote({ _opportunityid_value: 'opp1' })))
    client.me.get.mockImplementation((table: string) => {
      if (table === 'opportunity') {
        return Promise.resolve(
          single<Opportunity>({
            opportunityid: 'opp1',
            name: 'Firewall Upgrade Opportunity',
            estimatedvalue: 5000,
          }),
        )
      }
      return Promise.resolve(single(makeQuote({ _opportunityid_value: 'opp1' })))
    })
    renderPage()

    expect(await screen.findByText('Source opportunity')).toBeInTheDocument()
    expect(screen.getByText('Firewall Upgrade Opportunity')).toBeInTheDocument()
    expect(screen.getByText('£5,000')).toBeInTheDocument()
  })

  it('does not render the opportunity card when the quote has no opportunity link', async () => {
    client.me.get.mockResolvedValue(single(makeQuote()))
    renderPage()
    await screen.findByRole('heading', { name: 'Managed Firewall Renewal' })
    expect(screen.queryByText('Source opportunity')).not.toBeInTheDocument()
  })

  it('honours the tier hint (me) from list state', async () => {
    client.me.get.mockResolvedValue(single(makeQuote()))
    renderPage({ route: '/quotes/q1', state: { ids: ['q1'], tier: 'me' } })
    await screen.findByRole('heading', { name: 'Managed Firewall Renewal' })
    expect(client.me.get).toHaveBeenCalledWith('quote', 'q1', expect.anything())
  })

  it('navigates back to the list via the back button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.me.get.mockResolvedValue(single(makeQuote()))
    renderPage()
    await screen.findByRole('heading', { name: 'Managed Firewall Renewal' })
    await user.click(screen.getByRole('button', { name: 'Quotes' }))
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Managed Firewall Renewal' })).not.toBeInTheDocument(),
    )
  })
})
