import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, single, paginated, type MockClient } from '../test/dataverse'
import type { Opportunity } from '../types/dataverse.generated'
import type { Quote } from '../types/quote'
import { OpportunityDetailPage } from './OpportunityDetailPage'

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

function makeOpportunity(over: Partial<Opportunity> = {}): Opportunity {
  return {
    opportunityid: 'o1',
    name: 'Data centre expansion',
    description: 'Second hall fit-out.',
    estimatedvalue: 250000,
    estimatedclosedate: '2026-09-30T00:00:00Z',
    statecode_label: 'Open',
    statuscode_label: 'In Progress',
    createdon: '2026-01-10T00:00:00Z',
    modifiedon: '2026-06-01T00:00:00Z',
    ...over,
  }
}

function renderPage(opts: { route?: string; state?: unknown } = {}) {
  return renderWithProviders(<OpportunityDetailPage />, {
    path: '/opportunities/:id',
    route: opts.route ?? '/opportunities/o1',
    state: opts.state,
  })
}

describe('OpportunityDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // shouldAdvanceTime keeps real time flowing (so React Query + waitFor still
    // work) while Date.now() reports the fixed instant used for date formatting.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(NOW))
    // Default: no linked quotes unless a test opts in.
    client.me.list.mockResolvedValue(paginated<Quote>([]))
    client.team.list.mockResolvedValue(paginated<Quote>([]))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton while the opportunity is fetching', () => {
    client.me.get.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelector('.rc-skeleton')).not.toBeNull()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders an error message when the fetch rejects on both tiers', async () => {
    client.me.get.mockRejectedValue(new Error('me denied'))
    client.team.get.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('renders the header, status chip and meta grid on success', async () => {
    client.me.get.mockResolvedValue(single(makeOpportunity()))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Data centre expansion' })).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('£250,000')).toBeInTheDocument()
    expect(screen.getByText('30 Sept 2026')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Second hall fit-out.')).toBeInTheDocument()
  })

  it('falls back to "Untitled opportunity" when the name is empty', async () => {
    client.me.get.mockResolvedValue(single(makeOpportunity({ name: '' })))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Untitled opportunity' })).toBeInTheDocument()
  })

  it('omits the notes block when there is no description', async () => {
    client.me.get.mockResolvedValue(single(makeOpportunity({ description: '' })))
    renderPage()
    await screen.findByRole('heading', { name: 'Data centre expansion' })
    expect(screen.queryByText('Notes')).not.toBeInTheDocument()
  })

  it('shows the empty-state card when the opportunity has no quotes', async () => {
    client.me.get.mockResolvedValue(single(makeOpportunity()))
    renderPage()
    expect(await screen.findByText('No quotes on this opportunity yet.')).toBeInTheDocument()
  })

  it('lists the quotes raised against the opportunity with the section count', async () => {
    client.me.get.mockResolvedValue(single(makeOpportunity()))
    client.me.list.mockResolvedValue(
      paginated<Quote>([
        {
          quoteid: 'q1',
          name: 'Fit-out phase 1',
          quotenumber: 'QUO-1001',
          totalamount: 100000,
          statecode_label: 'Active',
        },
        {
          quoteid: 'q2',
          name: 'Fit-out phase 2',
          quotenumber: 'QUO-1002',
          totalamount: 150000,
          statecode_label: 'Draft',
        },
      ]),
    )
    renderPage()

    expect(await screen.findByText('Fit-out phase 1')).toBeInTheDocument()
    expect(screen.getByText('Fit-out phase 2')).toBeInTheDocument()
    expect(screen.getByText('QUO-1001')).toBeInTheDocument()
    expect(screen.getByText('£100,000')).toBeInTheDocument()
    // Quotes section title carries the count.
    expect(screen.getByText('(2)')).toBeInTheDocument()
    // Quotes were listed at the tier the opportunity resolved at (me).
    expect(client.me.list).toHaveBeenCalledWith(
      'quote',
      expect.objectContaining({
        filter: { field: '_opportunityid_value', operator: 'eq', value: 'o1' },
      }),
    )
  })

  it('lists quotes from the team tier when the opportunity resolved at team', async () => {
    client.me.get.mockRejectedValue(new Error('404'))
    client.team.get.mockResolvedValue(single(makeOpportunity()))
    client.team.list.mockResolvedValue(
      paginated<Quote>([
        { quoteid: 'q1', name: 'Company quote', totalamount: 5000, statecode_label: 'Active' },
      ]),
    )
    renderPage()

    expect(await screen.findByText('Company quote')).toBeInTheDocument()
    expect(client.team.list).toHaveBeenCalled()
  })

  it('navigates to a quote detail when a quote row is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.me.get.mockResolvedValue(single(makeOpportunity()))
    client.me.list.mockResolvedValue(
      paginated<Quote>([
        { quoteid: 'q1', name: 'Fit-out phase 1', totalamount: 100000, statecode_label: 'Active' },
      ]),
    )
    renderPage()

    await user.click(await screen.findByText('Fit-out phase 1'))
    // The route changes away from the detail page (no /quotes/:id route is
    // mounted in this harness, so the page simply unmounts).
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Data centre expansion' })).not.toBeInTheDocument(),
    )
  })

  it('honours the tier hint (me) from list state', async () => {
    client.me.get.mockResolvedValue(single(makeOpportunity()))
    renderPage({ route: '/opportunities/o1', state: { ids: ['o1'], tier: 'me' } })
    await screen.findByRole('heading', { name: 'Data centre expansion' })
    expect(client.me.get).toHaveBeenCalledWith('opportunity', 'o1', expect.anything())
  })

  it('navigates back to the list via the back button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.me.get.mockResolvedValue(single(makeOpportunity()))
    renderPage()
    await screen.findByRole('heading', { name: 'Data centre expansion' })
    await user.click(screen.getByRole('button', { name: 'Opportunities' }))
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Data centre expansion' })).not.toBeInTheDocument(),
    )
  })
})
