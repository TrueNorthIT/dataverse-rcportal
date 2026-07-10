import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AccountInfo } from '@azure/msal-browser'
import { _resetCacheDebug, recordCall } from '../../lib/cacheDebug'
import { CacheBadge, DEBUG_USER_EMAIL, isDebugUser } from './CacheBadge'

// MSAL is injected; the real accountToUser (pure) runs against this account.
let activeAccount: AccountInfo | null = null

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: { getActiveAccount: () => activeAccount },
    accounts: activeAccount ? [activeAccount] : [],
  }),
}))

function account(email: string): AccountInfo {
  return {
    homeAccountId: 'home-1',
    environment: 'login.local',
    tenantId: 't',
    username: email,
    localAccountId: 'local-1',
    idTokenClaims: { email },
  } as AccountInfo
}

afterEach(() => {
  _resetCacheDebug()
  activeAccount = null
})

describe('isDebugUser', () => {
  it('matches only the debug email, case-insensitively', () => {
    expect(isDebugUser(DEBUG_USER_EMAIL)).toBe(true)
    expect(isDebugUser('SDrake@TrueNorthIT.co.uk')).toBe(true)
    expect(isDebugUser('ada@acme.com')).toBe(false)
    expect(isDebugUser(undefined)).toBe(false)
  })
})

describe('CacheBadge', () => {
  it('renders nothing for a normal user', () => {
    activeAccount = account('ada@acme.com')
    render(<CacheBadge match="/aggregate/case" />)
    expect(screen.queryByTestId('cache-badge')).toBeNull()
  })

  it('shows the last matching call for the debug user', () => {
    activeAccount = account(DEBUG_USER_EMAIL)
    recordCall({
      url: '/api/v2/rc/team/aggregate/case?aggregate=count',
      method: 'GET',
      status: 200,
      cache: 'HIT',
      durationMs: 9,
      receivedAt: Date.now(),
    })
    render(<CacheBadge match="/aggregate/case" />)
    const badge = screen.getByTestId('cache-badge')
    expect(badge.textContent).toContain('HIT')
    expect(badge.textContent).toContain('9ms')
    expect(badge.textContent).toContain('1 req')
  })

  it('shows a placeholder before any matching request', () => {
    activeAccount = account(DEBUG_USER_EMAIL)
    render(<CacheBadge match="/aggregate/site" label="sites" />)
    expect(screen.getByTestId('cache-badge').textContent).toContain('no request')
  })
})
