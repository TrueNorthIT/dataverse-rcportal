import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AccountInfo } from '@azure/msal-browser'
import { ClarityTracker } from './ClarityTracker'
import { clarityIdentify, clarityTrackPage } from '../../lib/clarity'

// A mutable active account lets each test choose the signed-in state.
const { state } = vi.hoisted(() => ({ state: { account: null as AccountInfo | null } }))
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: { getActiveAccount: () => state.account } }),
}))

// The lib is unit-tested on its own; here we only assert the bridge calls it.
vi.mock('../../lib/clarity', () => ({
  clarityIdentify: vi.fn(),
  clarityTrackPage: vi.fn(),
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

  it('renders nothing', () => {
    const { container } = renderAt('/')
    expect(container).toBeEmptyDOMElement()
  })
})
