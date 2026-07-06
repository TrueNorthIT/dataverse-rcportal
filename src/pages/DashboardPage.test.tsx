import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, testQueryClient } from '../test/render'
import type { AttentionItem } from '../hooks/useAttention'
import type { DashboardStats } from '../hooks/useDashboard'
import type { Account } from '../types/account'
import { DashboardPage } from './DashboardPage'

// The dashboard composes several data hooks; mock each so a test decides exactly
// what the tiles / attention / company subtitle show.
const useDashboardMock = vi.fn()
const useAttentionMock = vi.fn()
const useMyCompanyMock = vi.fn()
const useSelectedCompanyMock = vi.fn()

vi.mock('../hooks/useDashboard', () => ({ useDashboard: () => useDashboardMock() }))
vi.mock('../hooks/useAttention', () => ({ useAttention: () => useAttentionMock() }))
vi.mock('../hooks/useMyCompany', () => ({ useMyCompany: () => useMyCompanyMock() }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => useSelectedCompanyMock(),
}))

// The charts + architecture note are heavy sub-trees exercised by their own
// tests; stub them so this file focuses on the dashboard shell's behaviour.
vi.mock('../components/dashboard/DashboardCharts', () => ({
  default: () => <div data-testid="dashboard-charts" />,
}))
vi.mock('../components/dashboard/ArchitectureNote', () => ({
  ArchitectureNote: () => <div data-testid="architecture-note" />,
}))
// CompanyScopeToggle reads MSAL; stub it to a simple marker for the multi-company
// branch (it renders only when hasMultiple is true anyway).
vi.mock('../components/dashboard/CompanyScopeToggle', () => ({
  CompanyScopeToggle: () => <div data-testid="scope-toggle" />,
}))

const stats = (over: Partial<DashboardStats> = {}): DashboardStats => ({
  cases: 4,
  quotes: 2,
  projects: 6,
  sites: 3,
  ...over,
})

function selectedCompany(over: Record<string, unknown> = {}) {
  return {
    selectedCompanyId: undefined,
    allCompanies: false,
    hasMultiple: false,
    companies: [],
    currentCompany: undefined,
    loading: false,
    selectCompany: vi.fn(),
    selectAllCompanies: vi.fn(),
    ...over,
  }
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDashboardMock.mockReturnValue({ stats: stats(), loading: false, stale: false })
    useAttentionMock.mockReturnValue({ items: [], loading: false, stale: false })
    useMyCompanyMock.mockReturnValue({ account: null, loading: false, error: null })
    useSelectedCompanyMock.mockReturnValue(selectedCompany())
  })

  it('renders the four headline stat tiles with formatted counts', () => {
    useDashboardMock.mockReturnValue({
      stats: stats({ cases: 1200, quotes: 2, projects: 6, sites: 3 }),
      loading: false,
      stale: false,
    })
    renderWithProviders(<DashboardPage />)

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Open tickets')).toBeInTheDocument()
    // Thousands grouped with en-GB locale.
    expect(screen.getByText('1,200')).toBeInTheDocument()
    expect(screen.getByText('Quotes')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Sites')).toBeInTheDocument()
  })

  it('shows an em dash for a null stat', () => {
    useDashboardMock.mockReturnValue({
      stats: stats({ cases: null }),
      loading: false,
      stale: false,
    })
    renderWithProviders(<DashboardPage />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows loading skeletons on first load (loading with no value yet)', () => {
    useDashboardMock.mockReturnValue({
      stats: stats({ cases: null, quotes: null, projects: null, sites: null }),
      loading: true,
      stale: false,
    })
    renderWithProviders(<DashboardPage />)

    // Each tile shows a "Loading" skeleton in place of the number.
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThanOrEqual(4)
  })

  it('shows skeletons when stale (previous scope number still on screen)', () => {
    useDashboardMock.mockReturnValue({ stats: stats(), loading: false, stale: true })
    renderWithProviders(<DashboardPage />)

    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThanOrEqual(4)
  })

  it('greets by company name when the account is known', () => {
    useMyCompanyMock.mockReturnValue({
      account: { name: 'Acme Ltd' } as Account,
      loading: false,
      error: null,
    })
    renderWithProviders(<DashboardPage />)

    expect(screen.getByText('Welcome — Acme Ltd')).toBeInTheDocument()
  })

  it('falls back to a plain welcome when there is no account', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })

  it('shows the across-all-companies subtitle when the scope is all', () => {
    useSelectedCompanyMock.mockReturnValue(
      selectedCompany({ allCompanies: true, hasMultiple: true }),
    )
    renderWithProviders(<DashboardPage />)

    expect(screen.getByText('Across all your companies')).toBeInTheDocument()
  })

  it('hides the scope toggle for a single-company user', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.queryByTestId('scope-toggle')).not.toBeInTheDocument()
  })

  it('shows the scope toggle for a multi-company user', () => {
    useSelectedCompanyMock.mockReturnValue(selectedCompany({ hasMultiple: true }))
    renderWithProviders(<DashboardPage />)

    expect(screen.getByTestId('scope-toggle')).toBeInTheDocument()
    // The updating indicator sits beside it, idle by default.
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status).toHaveTextContent('Up to date')
  })

  it('flags the sync indicator as updating while a dashboard query is in flight', async () => {
    useSelectedCompanyMock.mockReturnValue(selectedCompany({ hasMultiple: true }))
    // Seed the shared client with a never-resolving query under a dashboard
    // key root so useIsFetching reports work in progress.
    const queryClient = testQueryClient()
    void queryClient.prefetchQuery({
      queryKey: ['dashboard'],
      queryFn: () => new Promise(() => {}),
    })
    renderWithProviders(<DashboardPage />, { queryClient })

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Updating…'),
    )
  })

  it('renders the all-caught-up message when nothing needs attention', () => {
    renderWithProviders(<DashboardPage />)
    expect(
      screen.getByText('You’re all caught up — nothing needs attention.'),
    ).toBeInTheDocument()
  })

  it('shows "Checking…" while attention is still loading', () => {
    useAttentionMock.mockReturnValue({ items: [], loading: true, stale: false })
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText('Checking…')).toBeInTheDocument()
  })

  it('renders attention skeletons when stale', () => {
    useAttentionMock.mockReturnValue({ items: [], loading: false, stale: true })
    renderWithProviders(<DashboardPage />)
    // The attention card renders its own two loading placeholders.
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThanOrEqual(1)
  })

  it('lists attention items as deep links', () => {
    const items: AttentionItem[] = [
      { key: 'overdue', label: '2 overdue projects', count: 2, to: '/projects?f=overdue&s=due', tone: 'red' },
      { key: 'recent', label: '1 new quote in the last 30 days', count: 1, to: '/quotes?s=newest', tone: 'blue' },
    ]
    useAttentionMock.mockReturnValue({ items, loading: false, stale: false })
    renderWithProviders(<DashboardPage />)

    const overdue = screen.getByRole('link', { name: /2 overdue projects/ })
    expect(overdue).toHaveAttribute('href', '/projects?f=overdue&s=due')
    const recent = screen.getByRole('link', { name: /1 new quote in the last 30 days/ })
    expect(recent).toHaveAttribute('href', '/quotes?s=newest')
  })

  it('links each stat tile to its section', () => {
    renderWithProviders(<DashboardPage />)

    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/cases')
    expect(hrefs).toContain('/quotes')
    expect(hrefs).toContain('/projects')
    expect(hrefs).toContain('/sites')
  })

  it('renders the quick-action shortcuts', () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.getByText('Raise a ticket')).toBeInTheDocument()
    expect(screen.getByText('My profile')).toBeInTheDocument()
    expect(screen.getByText('My company')).toBeInTheDocument()
    // Profile / company shortcut destinations.
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/profile')
    expect(hrefs).toContain('/company')
  })

  it('lazy-loads the charts and the architecture note', async () => {
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByTestId('dashboard-charts')).toBeInTheDocument()
    expect(screen.getByTestId('architecture-note')).toBeInTheDocument()
  })

  it('scrolls to the insights section when the scroll hint is clicked', async () => {
    const user = userEvent.setup()
    // Give the hint a target to scroll to.
    const insights = document.createElement('div')
    insights.id = 'insights'
    document.body.appendChild(insights)
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderWithProviders(<DashboardPage />)
    await user.click(screen.getByRole('button', { name: 'Scroll to insights' }))

    expect(scrollSpy).toHaveBeenCalled()
    insights.remove()
    scrollSpy.mockRestore()
  })

  it('does nothing on scroll hint click when there is no insights target', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    renderWithProviders(<DashboardPage />)

    await user.click(screen.getByRole('button', { name: 'Scroll to insights' }))
    // No #insights element → early return, no scroll.
    expect(scrollSpy).not.toHaveBeenCalled()
    scrollSpy.mockRestore()
  })

  it('hides the scroll hint once the page is scrolled down', async () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByRole('button', { name: 'Scroll to insights' })).toBeInTheDocument()

    // Scroll past the threshold and dispatch the scroll event the hint listens for.
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Scroll to insights' })).not.toBeInTheDocument(),
    )
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
})
