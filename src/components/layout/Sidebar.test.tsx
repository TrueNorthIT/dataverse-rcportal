import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AccountInfo } from '@azure/msal-browser'
import type { Company } from '@truenorth-it/dataverse-client'
import { renderWithProviders } from '../../test/render'
import { SidebarContent } from './Sidebar'

// Feedback opens a dialog through this context; spy on it.
const openFeedback = vi.fn()
vi.mock('../common/FeedbackDialog', () => ({
  useFeedback: () => ({ open: openFeedback }),
}))

const logoutRedirect = vi.fn()
let activeAccount: AccountInfo | null
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: { getActiveAccount: () => activeAccount, logoutRedirect },
    accounts: activeAccount ? [activeAccount] : [],
  }),
}))

let companies: Company[]
let selectedCompanyId: string | undefined
const selectCompany = vi.fn()
vi.mock('../../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({
    companies,
    hasMultiple: companies.length > 1,
    currentCompany: companies.find((c) => c.companyId === selectedCompanyId) ?? companies[0],
    selectCompany,
  }),
}))

function account(): AccountInfo {
  return {
    homeAccountId: 'home-1',
    environment: 'login.local',
    tenantId: 't',
    username: '',
    localAccountId: 'local-1',
    idTokenClaims: { name: 'Regular User', email: 'user@customer.com' },
  } as AccountInfo
}

function company(companyId: string, companyName: string): Company {
  return { companyId, companyName, isDefault: false } as Company
}

describe('SidebarContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeAccount = account()
    companies = [company('c1', 'Acme Ltd')]
    selectedCompanyId = 'c1'
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the wordmark, the product name, and the section links', () => {
    renderWithProviders(<SidebarContent />)
    expect(screen.getByAltText('Redcentric')).toBeInTheDocument()
    expect(screen.getByText('Customer Hub')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Opportunities' })).toHaveAttribute('href', '/opportunities')
    expect(screen.getByRole('link', { name: 'Quotes' })).toHaveAttribute('href', '/quotes')
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects')
    expect(screen.getByRole('link', { name: 'Sites' })).toHaveAttribute('href', '/sites')
    expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/cases')
    expect(screen.getByRole('link', { name: 'My company' })).toHaveAttribute('href', '/company')
  })

  it('marks the link for the current route as active', () => {
    renderWithProviders(<SidebarContent />, { route: '/quotes' })
    expect(screen.getByRole('link', { name: 'Quotes' })).toHaveClass('bg-white/10', 'text-white')
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveClass('text-white/70')
  })

  it('treats Dashboard as end-exact (not active on a sub-route)', () => {
    renderWithProviders(<SidebarContent />, { route: '/quotes' })
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('text-white/70')
  })

  it('lists the help links and opens the feedback dialog from the Feedback button', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    renderWithProviders(<SidebarContent onNavigate={onNavigate} />)
    expect(screen.getByRole('link', { name: 'Knowledge base' })).toHaveAttribute('href', '/knowledge')
    expect(screen.getByRole('link', { name: 'AI assistant' })).toHaveAttribute('href', '/ai')

    await user.click(screen.getByRole('button', { name: 'Feedback' }))
    expect(openFeedback).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('reports a navigation when a section link is chosen', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    renderWithProviders(<SidebarContent onNavigate={onNavigate} />)
    await user.click(screen.getByRole('link', { name: 'Sites' }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('links the signed-in user row to the profile, and signs out from the button beside it', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    renderWithProviders(<SidebarContent onNavigate={onNavigate} />)
    const profile = screen.getByRole('link', { name: /Regular User/ })
    expect(profile).toHaveAttribute('href', '/profile')
    expect(profile).toHaveTextContent('user@customer.com')

    await user.click(profile)
    expect(onNavigate).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logoutRedirect).toHaveBeenCalledWith({ postLogoutRedirectUri: window.location.origin })
  })

  it('hides the companies group for a single-company user', () => {
    renderWithProviders(<SidebarContent />)
    expect(screen.queryByText('Your companies')).not.toBeInTheDocument()
  })

  it('lists the companies for a multi-company user, with initials badges, and switches on click', async () => {
    const user = userEvent.setup()
    companies = [company('c1', 'Acme Ltd'), company('c2', 'Globex Corp')]
    selectedCompanyId = 'c2'
    const onNavigate = vi.fn()
    renderWithProviders(<SidebarContent onNavigate={onNavigate} />)

    expect(screen.getByText('Your companies')).toBeInTheDocument()
    // The badge is aria-hidden, so the accessible name is the company alone.
    const current = screen.getByRole('button', { name: 'Globex Corp' })
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(within(current).getByText('GC')).toBeInTheDocument()
    const other = screen.getByRole('button', { name: 'Acme Ltd' })
    expect(other).not.toHaveAttribute('aria-current')
    // "Ltd" is a stopword, so Acme alone supplies the initial.
    expect(within(other).getByText('A')).toBeInTheDocument()

    await user.click(other)
    expect(selectCompany).toHaveBeenCalledWith('c1')
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })
})
