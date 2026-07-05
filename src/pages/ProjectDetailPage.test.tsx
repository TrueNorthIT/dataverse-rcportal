import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, single, paginated, type MockClient } from '../test/dataverse'
import type { Project } from '../types/project'
import type { Projecttask, Projectnotes } from '../types/dataverse.generated'
import { ProjectDetailPage } from './ProjectDetailPage'

// The page resolves its client + selected company through these two modules;
// mocking them lets a test drive exactly what each SDK call returns. publicClient
// is a lazy getter so the mock factory never reads `client` at hoist time.
const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client, publicClient: () => client }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({
    selectedContactId: undefined,
    allCompanies: false,
    companies: [],
    hasMultiple: false,
    loading: false,
  }),
}))

// A fixed "now" so RAG-health verdicts and formatted dates are deterministic.
const NOW = '2026-07-05T12:00:00Z'

function makeProject(over: Partial<Project> = {}): Project {
  return {
    msdyn_projectid: 'p1',
    msdyn_subject: 'Network Refresh',
    msdyn_scheduledstart: '2026-01-01T00:00:00Z',
    msdyn_finish: '2026-12-01T00:00:00Z',
    msdyn_actualstart: '2026-01-05T00:00:00Z',
    createdon: '2025-12-01T00:00:00Z',
    msdyn_description: 'Full site network refresh.',
    ...over,
  }
}

// Render the page mounted under the `/projects/:id` route so useParams resolves.
function renderPage(opts: { route?: string; state?: unknown } = {}) {
  return renderWithProviders(<ProjectDetailPage />, {
    path: '/projects/:id',
    route: opts.route ?? '/projects/p1',
    state: opts.state,
  })
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // shouldAdvanceTime keeps real time flowing (so React Query + waitFor still
    // work) while Date.now() reports the fixed instant used for date formatting.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(NOW))
    // Default: empty plan + notes so the plan section is absent unless a test
    // opts into it.
    client.team.list.mockResolvedValue(paginated<Projecttask>([]))
    client.me.list.mockResolvedValue(paginated<Projectnotes>([]))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton while the project is fetching', () => {
    client.team.get.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelector('.rc-skeleton')).not.toBeNull()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders an error message when the fetch rejects', async () => {
    // Both team then me fail → the auto-tier fallback surfaces the me error.
    client.team.get.mockRejectedValue(new Error('team denied'))
    client.me.get.mockRejectedValue(new Error('no access to project'))
    renderPage()
    expect(await screen.findByText('no access to project')).toBeInTheDocument()
  })

  it('renders the header, meta grid and description on success', async () => {
    client.team.get.mockResolvedValue(single(makeProject()))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Network Refresh' })).toBeInTheDocument()
    expect(screen.getByText('Scheduled start')).toBeInTheDocument()
    expect(screen.getByText('1 Jan 2026')).toBeInTheDocument()
    expect(screen.getByText('1 Dec 2026')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Full site network refresh.')).toBeInTheDocument()
  })

  it('falls back to the "Project" title when the subject is empty', async () => {
    client.team.get.mockResolvedValue(single(makeProject({ msdyn_subject: '' })))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Project' })).toBeInTheDocument()
  })

  it('omits the description block when there is no real description text', async () => {
    client.team.get.mockResolvedValue(single(makeProject({ msdyn_description: '' })))
    renderPage()
    await screen.findByRole('heading', { name: 'Network Refresh' })
    expect(screen.queryByText('Description')).not.toBeInTheDocument()
  })

  it('shows the "On track" RAG chip for a finish comfortably in the future', async () => {
    client.team.get.mockResolvedValue(single(makeProject({ msdyn_finish: '2026-12-01T00:00:00Z' })))
    renderPage()
    expect(await screen.findByText('On track')).toBeInTheDocument()
  })

  it('shows the "Due soon" RAG chip when the finish is within 30 days', async () => {
    client.team.get.mockResolvedValue(single(makeProject({ msdyn_finish: '2026-07-20T00:00:00Z' })))
    renderPage()
    expect(await screen.findByText('Due soon')).toBeInTheDocument()
  })

  it('shows the "Overdue" RAG chip when the finish has passed', async () => {
    client.team.get.mockResolvedValue(single(makeProject({ msdyn_finish: '2026-06-01T00:00:00Z' })))
    renderPage()
    expect(await screen.findByText('Overdue')).toBeInTheDocument()
  })

  it('shows the "Complete" RAG chip once an actual finish date is set', async () => {
    client.team.get.mockResolvedValue(
      single(makeProject({ msdyn_actualend: '2026-06-15T00:00:00Z' })),
    )
    renderPage()
    expect(await screen.findByText('Complete')).toBeInTheDocument()
    expect(screen.getByText(/Delivered 15 Jun 2026/)).toBeInTheDocument()
  })

  it('renders the delivery plan card when the project has milestones', async () => {
    client.team.get.mockResolvedValue(single(makeProject()))
    client.team.list.mockResolvedValue(
      paginated<Projecttask>([
        {
          new_projecttaskid: 'm1',
          new_name: 'Go live',
          new_ismilestone: true,
          new_startdate: '2026-11-01T00:00:00Z',
          new_percentcomplete: 0,
        },
      ]),
    )
    renderPage()

    expect(await screen.findByText('Delivery plan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /View full plan/ })).toBeInTheDocument()
    // The plan card surfaces the next incomplete milestone.
    expect(screen.getByText('Go live')).toBeInTheDocument()
  })

  it('opens the plan modal when "View full plan" is clicked and closes it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.get.mockResolvedValue(single(makeProject()))
    client.team.list.mockResolvedValue(
      paginated<Projecttask>([
        {
          new_projecttaskid: 'ph1',
          new_name: 'Design',
          new_ismilestone: false,
          new_startdate: '2026-01-10T00:00:00Z',
          new_enddate: '2026-03-10T00:00:00Z',
          new_percentcomplete: 100,
        },
      ]),
    )
    renderPage()

    await user.click(await screen.findByRole('button', { name: /View full plan/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Project plan' })
    expect(dialog).toBeInTheDocument()
    // Gantt tab shows the phase label.
    expect(within(dialog).getAllByText('Design').length).toBeGreaterThan(0)

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Project plan' })).not.toBeInTheDocument())
  })

  it('opens the plan modal directly from a #plan hash in the URL', async () => {
    client.team.get.mockResolvedValue(single(makeProject()))
    client.team.list.mockResolvedValue(
      paginated<Projecttask>([
        {
          new_projecttaskid: 'ph1',
          new_name: 'Design',
          new_ismilestone: false,
          new_startdate: '2026-01-10T00:00:00Z',
          new_enddate: '2026-03-10T00:00:00Z',
          new_percentcomplete: 100,
        },
      ]),
    )
    renderPage({ route: '/projects/p1#plan' })
    expect(await screen.findByRole('dialog', { name: 'Project plan' })).toBeInTheDocument()
  })

  it('enables prev/next stepping from list navigation state', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.get.mockResolvedValue(single(makeProject()))
    renderPage({
      route: '/projects/p1',
      state: { ids: ['p0', 'p1', 'p2'], from: '/projects', tier: 'team' },
    })

    await screen.findByRole('heading', { name: 'Network Refresh' })
    const prev = screen.getByRole('button', { name: 'Previous' })
    const next = screen.getByRole('button', { name: 'Next' })
    expect(prev).toBeEnabled()
    expect(next).toBeEnabled()

    // Stepping navigates within the /projects area (no throw, buttons still present).
    await user.click(next)
    await user.click(prev)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument()
  })

  it('honours the tier hint from list state (fetches straight from team)', async () => {
    client.team.get.mockResolvedValue(single(makeProject()))
    renderPage({ route: '/projects/p1', state: { ids: ['p1'], tier: 'team' } })
    await screen.findByRole('heading', { name: 'Network Refresh' })
    expect(client.team.get).toHaveBeenCalledWith('project', 'p1', expect.anything())
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('navigates back to the list via the back button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.get.mockResolvedValue(single(makeProject()))
    renderPage()
    await screen.findByRole('heading', { name: 'Network Refresh' })
    await user.click(screen.getByRole('button', { name: 'Projects' }))
    // Back with no `from` navigates to the base list; the component is unmounted
    // by the route change, so the heading disappears.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Network Refresh' })).not.toBeInTheDocument())
  })
})
