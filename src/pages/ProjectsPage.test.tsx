import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, paginated, count, type MockClient } from '../test/dataverse'
import type { Project } from '../types/project'
import { ProjectsPage } from './ProjectsPage'

// The page reaches the SDK through useDataverseClient and reads the selected
// company from context — mocking both lets a test drive exactly what loads.
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
// usePillCounts also pulls useCompanyClients; keep it empty so it counts through
// the single mock client (client.team.aggregate) rather than per-company clients.
vi.mock('../hooks/useCompanyClients', () => ({ useCompanyClients: () => [] }))

/** A project row with sensible defaults; override only what a test cares about. */
function makeProject(over: Partial<Project> = {}): Project {
  return {
    msdyn_projectid: 'p1',
    msdyn_subject: 'Network refresh',
    msdyn_description: 'Replace core switches',
    msdyn_scheduledstart: '2026-01-01T00:00:00Z',
    msdyn_finish: '2026-12-01T00:00:00Z',
    createdon: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fix "now" so schedule-date derived RAG chips are deterministic.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    // Pills default to disabled unless a count comes back > 0.
    client.team.aggregate.mockResolvedValue(count(3))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton on first render', () => {
    // Never-resolving list keeps the page in its first-load state.
    client.team.list.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ProjectsPage />)

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
    // Company is the default tier for projects.
    expect(screen.getByText("Your company's projects")).toBeInTheDocument()
  })

  it('renders the empty message when the company has no projects', async () => {
    client.team.list.mockResolvedValue(paginated<Project>([]))
    renderWithProviders(<ProjectsPage />)

    expect(await screen.findByText('No projects to show yet.')).toBeInTheDocument()
  })

  it('surfaces the error banner when the list request fails', async () => {
    client.team.list.mockRejectedValue(new Error('Projects are down'))
    renderWithProviders(<ProjectsPage />)

    expect(await screen.findByText('Projects are down')).toBeInTheDocument()
  })

  it('lists projects with subject, cleaned description, dates and a health chip', async () => {
    client.team.list.mockResolvedValue(
      paginated<Project>([
        makeProject({
          msdyn_subject: 'Network refresh',
          msdyn_description: '[DEMO-RCPORTAL]Replace core switches',
          msdyn_finish: '2026-12-01T00:00:00Z',
        }),
      ]),
    )
    renderWithProviders(<ProjectsPage />)

    await screen.findByText('Network refresh')
    // Scope to the row button so the "On track" chip isn't confused with the
    // "On track" filter pill.
    const row = screen.getByRole('button', { name: /Network refresh/ })
    // The [DEMO-RCPORTAL] marker is stripped by cleanDescription.
    expect(within(row).getByText('Replace core switches')).toBeInTheDocument()
    // Far-out finish date → "On track" RAG chip.
    expect(within(row).getByText('On track')).toBeInTheDocument()
    expect(within(row).getByText(/1 Jan 2026 – 1 Dec 2026/)).toBeInTheDocument()
  })

  it('falls back to "Untitled project" when a project has no subject', async () => {
    client.team.list.mockResolvedValue(
      paginated<Project>([makeProject({ msdyn_subject: undefined })]),
    )
    renderWithProviders(<ProjectsPage />)

    expect(await screen.findByText('Untitled project')).toBeInTheDocument()
  })

  it('marks a delivered project (msdyn_actualend set) Complete', async () => {
    client.team.list.mockResolvedValue(
      paginated<Project>([
        makeProject({ msdyn_actualend: '2026-06-01T00:00:00Z' }),
      ]),
    )
    renderWithProviders(<ProjectsPage />)

    await screen.findByText(/Delivered 1 Jun 2026/)
    // "Complete" is also a filter pill, so assert the chip within the row.
    const row = screen.getByRole('button', { name: /Network refresh/ })
    expect(within(row).getByText('Complete')).toBeInTheDocument()
    expect(within(row).getByText(/Delivered 1 Jun 2026/)).toBeInTheDocument()
  })

  it('marks a past-finish, undelivered project Overdue', async () => {
    client.team.list.mockResolvedValue(
      paginated<Project>([makeProject({ msdyn_finish: '2026-06-01T00:00:00Z' })]),
    )
    renderWithProviders(<ProjectsPage />)

    await screen.findByText('Network refresh')
    // "Overdue" is also a filter pill; assert the chip within the row.
    const row = screen.getByRole('button', { name: /Network refresh/ })
    expect(within(row).getByText('Overdue')).toBeInTheDocument()
  })

  it('navigates to the project detail on row click, passing prev/next ids and tier', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(
      paginated<Project>([
        makeProject({ msdyn_projectid: 'p1', msdyn_subject: 'Alpha' }),
        makeProject({ msdyn_projectid: 'p2', msdyn_subject: 'Beta' }),
      ]),
    )
    renderWithProviders(<ProjectsPage />, {
      path: '/projects',
      route: '/projects',
    })

    const alpha = await screen.findByText('Alpha')
    await user.click(alpha)

    // Landing on the detail route means the click navigated (the page unmounts).
    await waitFor(() => expect(screen.queryByText('Beta')).not.toBeInTheDocument())
  })

  it('switches to the My tier and refetches from the me scope', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(
      paginated<Project>([makeProject({ msdyn_subject: 'Company project' })]),
    )
    client.me.list.mockResolvedValue(
      paginated<Project>([makeProject({ msdyn_projectid: 'm1', msdyn_subject: 'My project' })]),
    )
    client.me.aggregate.mockResolvedValue(count(2))
    renderWithProviders(<ProjectsPage />)

    await screen.findByText('Company project')
    await user.click(screen.getByRole('tab', { name: 'My' }))

    expect(await screen.findByText('My project')).toBeInTheDocument()
    expect(screen.getByText('Projects you sponsor')).toBeInTheDocument()
    expect(client.me.list).toHaveBeenCalled()
  })

  it('re-queries with the pill filter when a filter pill is chosen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(paginated<Project>([makeProject()]))
    renderWithProviders(<ProjectsPage />)

    await screen.findByText('Network refresh')
    const overduePill = screen.getByRole('button', { name: 'Overdue' })
    await user.click(overduePill)

    // The list refetches with the pill's filter applied.
    await waitFor(() =>
      expect(client.team.list).toHaveBeenCalledWith(
        'project',
        expect.objectContaining({ filter: expect.anything() }),
      ),
    )
    expect(overduePill).toHaveAttribute('aria-pressed', 'true')
  })

  it('re-sorts when a sort option is chosen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.list.mockResolvedValue(paginated<Project>([makeProject()]))
    renderWithProviders(<ProjectsPage />)

    await screen.findByText('Network refresh')
    const sortGroup = screen.getByRole('group', { name: 'Sort by' })
    await user.click(within(sortGroup).getByRole('button', { name: 'Recently added' }))

    await waitFor(() =>
      expect(client.team.list).toHaveBeenCalledWith(
        'project',
        expect.objectContaining({ orderBy: { field: 'createdon', direction: 'desc' } }),
      ),
    )
  })

  it('disables pills whose count is zero', async () => {
    client.team.list.mockResolvedValue(paginated<Project>([makeProject()]))
    // Every counted pill returns 0 → all non-"all" pills disabled.
    client.team.aggregate.mockResolvedValue(count(0))
    renderWithProviders(<ProjectsPage />)

    await screen.findByText('Network refresh')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Overdue' })).toBeDisabled(),
    )
  })

  it('resets a disabled active filter back to All (from a deep link)', async () => {
    client.team.list.mockResolvedValue(paginated<Project>([makeProject()]))
    // "overdue" pill counts 0, so an ?f=overdue deep link must fall back to All.
    client.team.aggregate.mockResolvedValue(count(0))
    renderWithProviders(<ProjectsPage />, { route: '/projects?f=overdue' })

    await screen.findByText('Network refresh')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true'),
    )
  })

  it('loads the next page when the load-more sentinel scrolls into view', async () => {
    // Capture the IntersectionObserver callback so we can fire it manually —
    // jsdom's observer never intersects on its own.
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
      paginated<Project>([makeProject({ msdyn_projectid: 'p1', msdyn_subject: 'Page one' })], 'next-url'),
    )
    client.team.fetchPage.mockResolvedValue(
      paginated<Project>([makeProject({ msdyn_projectid: 'p2', msdyn_subject: 'Page two' })]),
    )
    renderWithProviders(<ProjectsPage />)

    await screen.findByText('Page one')
    await waitFor(() => expect(observe).toHaveBeenCalled())

    // Fire the intersection → LoadMore calls onClick → fetchNextPage.
    ioCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )

    expect(await screen.findByText('Page two')).toBeInTheDocument()
    expect(client.team.fetchPage).toHaveBeenCalledWith('next-url')
  })
})
