import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AccountInfo } from '@azure/msal-browser'
import type { Account } from '../../types/account'
import { AppShell } from './AppShell'

// Child chrome is exercised in its own suites — stub it so these tests focus on
// the shell's own logic (header, nav-hide, operator footer gating).
vi.mock('./NavTabs', () => ({ NavTabs: () => <nav data-testid="nav-tabs" /> }))
vi.mock('./CompanySwitcher', () => ({
  CompanySwitcher: () => <div data-testid="company-switcher" />,
}))
vi.mock('./UserMenu', () => ({ UserMenu: () => <div data-testid="user-menu" /> }))

let activeAccount: AccountInfo | null
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: { getActiveAccount: () => activeAccount },
    accounts: activeAccount ? [activeAccount] : [],
  }),
}))

let myAccount: Account | null
vi.mock('../../hooks/useMyCompany', () => ({
  useMyCompany: () => ({ account: myAccount, loading: false, error: null }),
}))

let navHidden = false
vi.mock('../../hooks/useHideOnScroll', () => ({
  useHideOnScroll: () => navHidden,
}))

// DATAVERSE_URL is unset in the test env; mock the module so tests can turn the
// operator footer link on and off. Keep the real `env` export so config/entra
// (which imports it) still resolves.
let dataverseUrl: string | undefined
vi.mock('../../env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../env')>()
  return {
    ...actual,
    get DATAVERSE_URL() {
      return dataverseUrl
    },
  }
})

function account(over: Partial<AccountInfo> = {}): AccountInfo {
  return {
    homeAccountId: 'home-1',
    environment: 'login.local',
    tenantId: 't',
    username: '',
    localAccountId: 'local-1',
    idTokenClaims: { name: 'Regular User', email: 'user@customer.com' },
    ...over,
  } as AccountInfo
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div data-testid="page">Routed page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeAccount = account()
    myAccount = { name: 'Acme Ltd', accountid: 'acc-1' } as Account
    navHidden = false
    dataverseUrl = undefined
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the brand bar, the child chrome, and the routed outlet', () => {
    renderShell()
    expect(screen.getByAltText('Redcentric')).toBeInTheDocument()
    expect(screen.getByText('Customer Portal')).toBeInTheDocument()
    expect(screen.getByTestId('nav-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('company-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('user-menu')).toBeInTheDocument()
    expect(screen.getByTestId('page')).toHaveTextContent('Routed page')
  })

  it('keeps the header on screen when nav is not hidden', () => {
    const { container } = renderShell()
    const header = container.querySelector('header') as HTMLElement
    expect(header).not.toHaveClass('-translate-y-full')
  })

  it('collapses the header when useHideOnScroll reports hidden', () => {
    navHidden = true
    const { container } = renderShell()
    const header = container.querySelector('header') as HTMLElement
    expect(header).toHaveClass('-translate-y-full')
  })

  it('does not render the operator footer for a non-operator user', () => {
    dataverseUrl = 'https://org.crm.dynamics.com'
    activeAccount = account({ idTokenClaims: { email: 'user@customer.com' } })
    renderShell()
    expect(screen.queryByRole('link', { name: /Dataverse/ })).not.toBeInTheDocument()
  })

  it('does not render the footer when DATAVERSE_URL is unset even for the operator', () => {
    dataverseUrl = undefined
    activeAccount = account({ idTokenClaims: { email: 'steve@drakey.co.uk' } })
    renderShell()
    expect(screen.queryByRole('link', { name: /Dataverse/ })).not.toBeInTheDocument()
  })

  it('renders the deep link to the specific account for the operator', () => {
    dataverseUrl = 'https://org.crm.dynamics.com'
    activeAccount = account({ idTokenClaims: { email: 'steve@drakey.co.uk' } })
    myAccount = { name: 'Acme Ltd', accountid: 'acc-1' } as Account
    renderShell()

    const link = screen.getByRole('link', { name: /View Acme Ltd in Dataverse/ })
    expect(link).toHaveAttribute(
      'href',
      'https://org.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=account&id=acc-1',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('matches the operator email case-insensitively', () => {
    dataverseUrl = 'https://org.crm.dynamics.com'
    activeAccount = account({ idTokenClaims: { email: 'Steve@Drakey.CO.UK' } })
    renderShell()
    expect(screen.getByRole('link', { name: /Dataverse/ })).toBeInTheDocument()
  })

  it('falls back to the environment root link when the account has no id', () => {
    dataverseUrl = 'https://org.crm.dynamics.com'
    activeAccount = account({ idTokenClaims: { email: 'steve@drakey.co.uk' } })
    myAccount = null
    renderShell()

    const link = screen.getByRole('link', { name: /Open Dataverse environment/ })
    expect(link).toHaveAttribute('href', 'https://org.crm.dynamics.com')
  })
})
