import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, paginated, count, type MockClient } from '../test/dataverse'
import type { Opportunity } from '../types/dataverse.generated'
import { OpportunitiesPage } from './OpportunitiesPage'

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

/** An opportunity row with sensible defaults; override what a test cares about. */
function makeOpportunity(over: Partial<Opportunity> = {}): Opportunity {
  return {
    opportunityid: 'o1',
    name: 'Data centre expansion',
    description: 'Second hall fit-out',
    estimatedvalue: 250000,
    estimatedclosedate: '2026-09-30T00:00:00Z',
    createdon: '2026-05-01T00:00:00Z',
    statecode_label: 'Open',
    ...over,
  }
}

describe('OpportunitiesPage', () => {
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
    renderWithProviders(<OpportunitiesPage />)

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument()
    expect(screen.getByText("Your company's pipeline")).toBeInTheDocument()
  })

  it('renders the empty message when there are no opportunities', async () => {
    client.team.list.mockResolvedValue(paginated<Opportunity>([]))
    renderWithProviders(<OpportunitiesPage />)

    expect(await screen.findByText('No opportunities to show yet.')).toBeInTheDocument()
  })

  it('surfaces the error banner when the list request fails', async () => {
    client.team.list.mockRejectedValue(new Error('Opportunities unavailable'))
    renderWithProviders(<OpportunitiesPage />)

    expect(await screen.findByText('Opportunities unavailable')).toBeInTheDocument()
  })

  it('lists opportunities with name, close date, currency value and state chip', async () => {
    client.team.list.mockResolvedValue(
      paginated<Opportunity>([
        makeOpportunity({
          name: 'Data centre expansion',
          description: '[DEMO-RCPORTAL]Second hall fit-out',
          estimatedvalue: 250000,
          estimatedclosedate: '2026-09-30T00:00:00Z',
          statecode_label: 'Open',
        }),
      ]),
    )
    renderWithProviders(<OpportunitiesPage />)

    await screen.findByText('Data centre expansion')
    const row = screen.getByRole('button', { name: /Data centre expansion/ })
    // Cleaned description (marker stripped).
    expect(within(row).getByText('Second hall fit-out')).toBeInTheDocument()
    expect(within(row).getByText(/Closes 30 Sept 2026/)).toBeInTheDocument()
    // GBP currency formatting, no decimals.
    expect(within(row).getByText('£250,000')).toBeInTheDocument()
    // "Open" is also a filter pill; assert the state chip within the row.
    expect(within(row).getByText('Open')).toBeInTheDocument()
  })

  it('falls back to "Untitled opportunity" when unnamed', async () => {
    client.team.list.mockResolvedValue(
      paginated<Opportunity>([makeOpportunity({ name: undefined })]),
    )
    renderWithProviders(<OpportunitiesPage />)

    expect(await screen.findByText('Untitled opportunity')).toBeInTheDocument()
  })

  it('shows an em dash for an opportunity with no value', async () => {
    client.team.list.mockResolvedValue(
      paginated<Opportunity>([makeOpportunity({ estimatedvalue: undefined })]),
    )
    renderWithProviders(<OpportunitiesPage />)

    await screen.findByText('Data centre expansion')
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('sorts by soonest close date by default', async () => {
    client.team.list.mockResolvedValue(paginated<Opportunity>([makeOpportunity()]))
    renderWithProviders(<OpportunitiesPage />)

    await screen.findByText('Data centre expansion')
    expect(client.team.list).toHaveBeenCalledWith(
      'opportunity',
      expect.objectContaining({
        orderBy: { field: 'estimatedclosedate', direction: 'asc' },
      }),
    )
  })

  it('navigates to the opportunity detail on row click', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(
      paginated<Opportunity>([
        makeOpportunity({ opportunityid: 'o1', name: 'Alpha deal' }),
        makeOpportunity({ opportunityid: 'o2', name: 'Beta deal' }),
      ]),
    )
    renderWithProviders(<OpportunitiesPage />, { path: '/opportunities', route: '/opportunities' })

    await user.click(await screen.findByText('Alpha deal'))
    await waitFor(() => expect(screen.queryByText('Beta deal')).not.toBeInTheDocument())
  })

  it('switches to the My tier and refetches from the me scope', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(
      paginated<Opportunity>([makeOpportunity({ name: 'Company deal' })]),
    )
    client.me.list.mockResolvedValue(
      paginated<Opportunity>([makeOpportunity({ opportunityid: 'm1', name: 'My deal' })]),
    )
    client.me.aggregate.mockResolvedValue(count(2))
    renderWithProviders(<OpportunitiesPage />)

    await screen.findByText('Company deal')
    await user.click(screen.getByRole('tab', { name: 'My' }))

    expect(await screen.findByText('My deal')).toBeInTheDocument()
    expect(screen.getByText('Opportunities you lead')).toBeInTheDocument()
    expect(client.me.list).toHaveBeenCalled()
  })

  it('re-queries with the state filter when a filter pill is chosen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(paginated<Opportunity>([makeOpportunity()]))
    renderWithProviders(<OpportunitiesPage />)

    await screen.findByText('Data centre expansion')
    const wonPill = screen.getByRole('button', { name: 'Won' })
    await user.click(wonPill)

    await waitFor(() =>
      expect(client.team.list).toHaveBeenCalledWith(
        'opportunity',
        expect.objectContaining({ filter: expect.anything() }),
      ),
    )
    expect(wonPill).toHaveAttribute('aria-pressed', 'true')
  })

  it('re-sorts when a sort option is chosen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(paginated<Opportunity>([makeOpportunity()]))
    renderWithProviders(<OpportunitiesPage />)

    await screen.findByText('Data centre expansion')
    const sortGroup = screen.getByRole('group', { name: 'Sort by' })
    await user.click(within(sortGroup).getByRole('button', { name: 'Value (high–low)' }))

    await waitFor(() =>
      expect(client.team.list).toHaveBeenCalledWith(
        'opportunity',
        expect.objectContaining({ orderBy: { field: 'estimatedvalue', direction: 'desc' } }),
      ),
    )
  })

  it('disables pills whose count is zero', async () => {
    client.team.list.mockResolvedValue(paginated<Opportunity>([makeOpportunity()]))
    client.team.aggregate.mockResolvedValue(count(0))
    renderWithProviders(<OpportunitiesPage />)

    await screen.findByText('Data centre expansion')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Won' })).toBeDisabled())
  })
})
