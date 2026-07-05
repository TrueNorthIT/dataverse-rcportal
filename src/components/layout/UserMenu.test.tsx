import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AccountInfo } from '@azure/msal-browser'
import type { Account } from '../../types/account'
import { renderWithProviders } from '../../test/render'
import { UserMenu } from './UserMenu'

// MSAL, the caller's company, and multi-company state are all injected. The real
// accountToUser (pure) runs against the account we hand useMsal here.
const logoutRedirect = vi.fn()
let activeAccount: AccountInfo | null

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: {
      getActiveAccount: () => activeAccount,
      logoutRedirect,
    },
    accounts: activeAccount ? [activeAccount] : [],
  }),
}))

let myCompany: { account: Account | null; loading: boolean; error: string | null }
vi.mock('../../hooks/useMyCompany', () => ({
  useMyCompany: () => myCompany,
}))

let hasMultiple = false
vi.mock('../../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({ hasMultiple }),
}))

function account(over: Partial<AccountInfo> = {}): AccountInfo {
  return {
    homeAccountId: 'home-1',
    environment: 'login.local',
    tenantId: 't',
    username: '',
    localAccountId: 'local-1',
    idTokenClaims: { name: 'Ada Lovelace', email: 'ada@acme.com' },
    ...over,
  } as AccountInfo
}

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeAccount = account()
    myCompany = { account: { name: 'Acme Ltd' } as Account, loading: false, error: null }
    hasMultiple = false
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the signed-in first name on the chip', () => {
    renderWithProviders(<UserMenu />)
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // First name only on the chip (full name lives in the popover).
    expect(within(trigger).getByText('Ada')).toBeInTheDocument()
  })

  it('opens the popover with the full name, email, and company', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)

    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(menu).getByText('ada@acme.com')).toBeInTheDocument()
    // Single-company case repeats the company name in the popover.
    expect(within(menu).getByText('Acme Ltd')).toBeInTheDocument()
  })

  it('links to My profile and My company', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByRole('menuitem', { name: 'My profile' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('menuitem', { name: 'My company' })).toHaveAttribute('href', '/company')
  })

  it('does not repeat the company name when the caller has multiple companies', async () => {
    hasMultiple = true
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    const menu = screen.getByRole('menu')
    expect(within(menu).queryByText('Acme Ltd')).not.toBeInTheDocument()
  })

  it('omits the company line when the account is not yet loaded', async () => {
    myCompany = { account: null, loading: true, error: null }
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(within(screen.getByRole('menu')).queryByText('Acme Ltd')).not.toBeInTheDocument()
  })

  it('closes the popover when a menu link is chosen', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    await user.click(screen.getByRole('menuitem', { name: 'My profile' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('signs out via MSAL logoutRedirect back to the origin', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(logoutRedirect).toHaveBeenCalledWith({
      postLogoutRedirectUri: window.location.origin,
    })
  })

  it('toggles shut on a second trigger click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)
    const trigger = screen.getByRole('button', { name: 'Account menu' })

    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on outside pointerdown', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <UserMenu />
        <button type="button">outside</button>
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button', { name: 'outside' }) })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('falls back to the email when there is no name claim', () => {
    activeAccount = account({ idTokenClaims: { email: 'grace@navy.mil' } })
    renderWithProviders(<UserMenu />)
    // displayName falls back to email; firstName is the whole email (no spaces).
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(within(trigger).getByText('grace@navy.mil')).toBeInTheDocument()
  })

  it('falls back to "Account" when there is no signed-in user at all', async () => {
    activeAccount = null
    const user = userEvent.setup()
    renderWithProviders(<UserMenu />)

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(within(trigger).getByText('Account')).toBeInTheDocument()

    // Opening the popover: no email line, and the header shows "Account".
    await user.click(trigger)
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Account')).toBeInTheDocument()
  })

  it('renders a two-letter monogram from first and last name', () => {
    const { container } = renderWithProviders(<UserMenu />)
    // Avatar is decorative (aria-hidden) and shows the initials.
    const avatar = container.querySelector('span[aria-hidden="true"]')
    expect(avatar).toHaveTextContent('AL')
  })
})
