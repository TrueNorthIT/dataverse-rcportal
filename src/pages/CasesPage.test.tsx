import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, paginated, single, count, type MockClient } from '../test/dataverse'
import type { Case } from '../types/case'
import { CasesPage } from './CasesPage'

// One shared mock client the page resolves through.
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
// usePillCounts pulls company clients for the all-companies roll-up; the page
// never uses it, so keep it out of the way.
vi.mock('../hooks/useCompanyClients', () => ({ useCompanyClients: () => [] }))

// Navigation is a side effect we want to observe without leaving the page.
const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigate }
})

function makeCase(over: Partial<Case> = {}): Case {
  return {
    incidentid: 'c1',
    title: 'Printer on fire',
    ticketnumber: 'INC-001',
    description: 'The office printer is smoking.',
    statuscode_label: 'In Progress',
    prioritycode_label: 'High',
    createdon: '2026-07-01T09:00:00Z',
    ...(over as Case),
  } as Case
}

describe('CasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Enable the priority pills (a count of 0 disables + can reset the pill).
    client.team.aggregate.mockResolvedValue(count(4))
    client.me.aggregate.mockResolvedValue(count(4))
  })

  const user = () => userEvent.setup()

  it('shows the loading skeleton on first load', () => {
    client.team.list.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<CasesPage />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('renders the company tickets with title, ticket number and status', async () => {
    client.team.list.mockResolvedValue(paginated<Case>([makeCase()]))
    renderWithProviders(<CasesPage />)

    expect(await screen.findByText('Printer on fire')).toBeInTheDocument()
    expect(screen.getByText(/INC-001/)).toBeInTheDocument()
    expect(screen.getByText('The office printer is smoking.')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    // Company tier is the default (initialTier='team').
    expect(screen.getByText("Your company's tickets")).toBeInTheDocument()
    expect(client.team.list).toHaveBeenCalled()
  })

  it('falls back to "Untitled" when a case has no title', async () => {
    client.team.list.mockResolvedValue(paginated<Case>([makeCase({ title: '' })]))
    renderWithProviders(<CasesPage />)
    expect(await screen.findByText('Untitled')).toBeInTheDocument()
  })

  it('shows the company empty message when there are no tickets', async () => {
    client.team.list.mockResolvedValue(paginated<Case>([]))
    renderWithProviders(<CasesPage />)
    expect(await screen.findByText('No tickets for your company yet.')).toBeInTheDocument()
  })

  it('surfaces the error message when the list request fails', async () => {
    client.team.list.mockRejectedValue(new Error('Service unavailable'))
    renderWithProviders(<CasesPage />)
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
  })

  it('switches to the "My" tier and shows the personal empty message', async () => {
    client.team.list.mockResolvedValue(paginated<Case>([makeCase()]))
    client.me.list.mockResolvedValue(paginated<Case>([]))
    renderWithProviders(<CasesPage />)
    await screen.findByText('Printer on fire')

    await user().click(screen.getByRole('tab', { name: 'My' }))

    expect(await screen.findByText("You haven't raised any tickets yet.")).toBeInTheDocument()
    expect(screen.getByText('Tickets you raised')).toBeInTheDocument()
    expect(client.me.list).toHaveBeenCalled()
  })

  it('navigates to a case detail with the sibling ids in location state', async () => {
    client.team.list.mockResolvedValue(
      paginated<Case>([makeCase({ incidentid: 'c1' }), makeCase({ incidentid: 'c2', title: 'Second' })]),
    )
    renderWithProviders(<CasesPage />)
    await screen.findByText('Printer on fire')

    await user().click(screen.getByText('Printer on fire'))

    expect(navigate).toHaveBeenCalledWith(
      '/cases/c1',
      expect.objectContaining({
        state: expect.objectContaining({ ids: ['c1', 'c2'], tier: 'team' }),
      }),
    )
  })

  describe('raise a ticket', () => {
    beforeEach(() => {
      client.team.list.mockResolvedValue(paginated<Case>([makeCase()]))
    })

    it('toggles the raise form open and closed', async () => {
      renderWithProviders(<CasesPage />)
      await screen.findByText('Printer on fire')
      const u = user()

      await u.click(screen.getByRole('button', { name: 'Raise a ticket' }))
      expect(screen.getByPlaceholderText('Brief summary of the issue')).toBeInTheDocument()

      await u.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByPlaceholderText('Brief summary of the issue')).not.toBeInTheDocument()
    })

    it('disables submit until a summary is typed', async () => {
      renderWithProviders(<CasesPage />)
      await screen.findByText('Printer on fire')
      const u = user()

      await u.click(screen.getByRole('button', { name: 'Raise a ticket' }))
      expect(screen.getByRole('button', { name: 'Submit ticket' })).toBeDisabled()

      await u.type(screen.getByPlaceholderText('Brief summary of the issue'), 'Broken laptop')
      expect(screen.getByRole('button', { name: 'Submit ticket' })).toBeEnabled()
    })

    it('creates a case, switches to My tier and closes the form on success', async () => {
      client.me.create.mockResolvedValue(single<Case>(makeCase({ incidentid: 'new' })))
      client.me.list.mockResolvedValue(paginated<Case>([makeCase({ incidentid: 'new', title: 'Broken laptop' })]))
      renderWithProviders(<CasesPage />)
      await screen.findByText('Printer on fire')
      const u = user()

      await u.click(screen.getByRole('button', { name: 'Raise a ticket' }))
      await u.type(screen.getByPlaceholderText('Brief summary of the issue'), 'Broken laptop')
      await u.type(screen.getByPlaceholderText("What's happening, and any impact?"), 'It won’t boot')
      await u.click(screen.getByRole('button', { name: 'Submit ticket' }))

      await waitFor(() =>
        expect(client.me.create).toHaveBeenCalledWith(
          'case',
          expect.objectContaining({ title: 'Broken laptop', description: 'It won’t boot' }),
        ),
      )
      // Form closed and we flipped to the My tier.
      await waitFor(() =>
        expect(screen.queryByPlaceholderText('Brief summary of the issue')).not.toBeInTheDocument(),
      )
      expect(screen.getByText('Tickets you raised')).toBeInTheDocument()
    })

    it('shows an error message when creating a case fails', async () => {
      client.me.create.mockRejectedValue(new Error('Quota exceeded'))
      renderWithProviders(<CasesPage />)
      await screen.findByText('Printer on fire')
      const u = user()

      await u.click(screen.getByRole('button', { name: 'Raise a ticket' }))
      await u.type(screen.getByPlaceholderText('Brief summary of the issue'), 'Broken laptop')
      await u.click(screen.getByRole('button', { name: 'Submit ticket' }))

      expect(await screen.findByText('Quota exceeded')).toBeInTheDocument()
      // Form stays open so the user can retry.
      expect(screen.getByPlaceholderText('Brief summary of the issue')).toBeInTheDocument()
    })
  })

  describe('filter pills', () => {
    it('filters by priority and refetches with the pill filter', async () => {
      client.team.list.mockResolvedValue(paginated<Case>([makeCase()]))
      renderWithProviders(<CasesPage />)
      await screen.findByText('Printer on fire')

      await user().click(screen.getByRole('button', { name: 'High' }))

      await waitFor(() =>
        expect(client.team.list).toHaveBeenCalledWith(
          'case',
          expect.objectContaining({ filter: expect.objectContaining({ field: 'prioritycode' }) }),
        ),
      )
    })

    it('disables a pill whose count is zero', async () => {
      client.team.list.mockResolvedValue(paginated<Case>([makeCase()]))
      // 'high' pill counts zero -> disabled; others non-zero.
      client.team.aggregate.mockImplementation((_table, opts) => {
        const filter = (opts as { filter?: { value?: number } } | undefined)?.filter
        return Promise.resolve(count(filter?.value === 1 ? 0 : 5))
      })
      renderWithProviders(<CasesPage />)
      await screen.findByText('Printer on fire')

      await waitFor(() => expect(screen.getByRole('button', { name: 'High' })).toBeDisabled())
    })

    it('sorts the list oldest-first when the sort pill is chosen', async () => {
      client.team.list.mockResolvedValue(paginated<Case>([makeCase()]))
      renderWithProviders(<CasesPage />)
      await screen.findByText('Printer on fire')

      await user().click(screen.getByRole('button', { name: 'Oldest' }))

      await waitFor(() =>
        expect(client.team.list).toHaveBeenCalledWith(
          'case',
          expect.objectContaining({ orderBy: { field: 'createdon', direction: 'asc' } }),
        ),
      )
    })
  })

  it('does not render a description paragraph when the description is only a demo marker', async () => {
    client.team.list.mockResolvedValue(
      paginated<Case>([makeCase({ description: '[DEMO-RCPORTAL]' })]),
    )
    const { container } = renderWithProviders(<CasesPage />)
    await screen.findByText('Printer on fire')
    // The cleaned description is empty, so no line-clamped paragraph appears.
    expect(within(container).queryByText('[DEMO-RCPORTAL]')).not.toBeInTheDocument()
  })

  it('omits the ticket-number prefix when a case has no ticket number', async () => {
    client.team.list.mockResolvedValue(
      paginated<Case>([makeCase({ ticketnumber: undefined })]),
    )
    renderWithProviders(<CasesPage />)
    await screen.findByText('Printer on fire')
    // Without a ticket number the "· " prefix is gone; only "Raised …" remains.
    expect(screen.queryByText(/INC-001/)).not.toBeInTheDocument()
    expect(screen.getByText(/Raised/)).toBeInTheDocument()
  })

  it('falls back to the default (newest) sort for an unknown ?s= value', async () => {
    client.team.list.mockResolvedValue(paginated<Case>([makeCase()]))
    renderWithProviders(<CasesPage />, { route: '/cases?s=bogus' })
    await screen.findByText('Printer on fire')
    await waitFor(() =>
      expect(client.team.list).toHaveBeenCalledWith(
        'case',
        expect.objectContaining({ orderBy: { field: 'createdon', direction: 'desc' } }),
      ),
    )
  })

  it('shows a generic error when a non-Error is thrown while raising a ticket', async () => {
    client.team.list.mockResolvedValue(paginated<Case>([makeCase()]))
    client.me.create.mockRejectedValue('nope')
    renderWithProviders(<CasesPage />)
    await screen.findByText('Printer on fire')
    const u = user()

    await u.click(screen.getByRole('button', { name: 'Raise a ticket' }))
    await u.type(screen.getByPlaceholderText('Brief summary of the issue'), 'Broken laptop')
    await u.click(screen.getByRole('button', { name: 'Submit ticket' }))

    expect(await screen.findByText('Failed to raise ticket')).toBeInTheDocument()
  })
})
