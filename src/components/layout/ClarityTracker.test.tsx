import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AccountInfo } from '@azure/msal-browser'
import { ClarityTracker } from './ClarityTracker'
import { claritySetTag, clarityIdentify, clarityTrackPage } from '../../lib/clarity'

// Mutable state lets each test choose the signed-in account and company.
const { state } = vi.hoisted(() => ({
  state: {
    account: null as AccountInfo | null,
    company: undefined as { companyName: string | null } | undefined,
  },
}))
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: { getActiveAccount: () => state.account } }),
}))
vi.mock('../../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({ currentCompany: state.company }),
}))

// The lib is unit-tested on its own; here we only assert the bridge calls it.
vi.mock('../../lib/clarity', () => ({
  clarityIdentify: vi.fn(),
  clarityTrackPage: vi.fn(),
  claritySetTag: vi.fn(),
}))

const account = {
  homeAccountId: 'home-1',
  idTokenClaims: { email: 'ada@example.com', name: 'Ada Lovelace' },
  username: 'ada@example.com',
} as unknown as AccountInfo

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ClarityTracker />
    </MemoryRouter>,
  )
}

describe('ClarityTracker', () => {
  beforeEach(() => {
    state.account = null
    state.company = undefined
    vi.clearAllMocks()
  })

  it('identifies the signed-in user and tags the current route', () => {
    state.account = account
    renderAt('/cases')
    expect(clarityIdentify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'home-1', email: 'ada@example.com' }),
    )
    expect(clarityTrackPage).toHaveBeenCalledWith('/cases')
  })

  it('still tags the route when there is no active account', () => {
    renderAt('/quotes')
    expect(clarityIdentify).toHaveBeenCalledWith(undefined)
    expect(clarityTrackPage).toHaveBeenCalledWith('/quotes')
  })

  it('tags the session with the deployment environment', () => {
    renderAt('/')
    // In vitest DEPLOY_ENV falls back to Vite's mode ("test").
    expect(claritySetTag).toHaveBeenCalledWith('env', 'test')
  })

  it('tags the session with the acting company once resolved', () => {
    state.company = { companyName: 'Chevin Print' }
    renderAt('/')
    expect(claritySetTag).toHaveBeenCalledWith('company', 'Chevin Print')
  })

  it('does not tag a company when there is none (or no name)', () => {
    state.company = { companyName: null }
    renderAt('/')
    expect(claritySetTag).not.toHaveBeenCalledWith('company', expect.anything())
  })

  it('renders nothing', () => {
    const { container } = renderAt('/')
    expect(container).toBeEmptyDOMElement()
  })
})
