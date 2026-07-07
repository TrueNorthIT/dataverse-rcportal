import { describe, expect, it } from 'vitest'
import type { AccountInfo } from '@azure/msal-browser'
import { accountToUser, apiOrigin, dataverseScope, entraConfig } from './entra'

/** Minimal AccountInfo builder — only the fields accountToUser reads. */
function account(over: Partial<AccountInfo> = {}): AccountInfo {
  return {
    homeAccountId: 'home-1',
    environment: 'login.local',
    tenantId: 't',
    username: '',
    localAccountId: 'local-1',
    ...over,
  } as AccountInfo
}

describe('config derivation from VITE_API_BASE_URL', () => {
  it('splits the base URL into an origin and the trailing scope', () => {
    expect(apiOrigin).toBe('https://api.test.local')
    expect(dataverseScope).toBe('rcportal')
  })

  it('carries the Entra app registration values and origin redirect', () => {
    expect(entraConfig.tenantId).toBe('test-tenant')
    expect(entraConfig.clientId).toBe('test-client')
    expect(entraConfig.apiScope).toBe('api://test/access_as_user')
    expect(entraConfig.redirectUri).toBe(window.location.origin)
  })
})

describe('accountToUser', () => {
  it('returns undefined when there is no account', () => {
    expect(accountToUser(null)).toBeUndefined()
    expect(accountToUser(undefined)).toBeUndefined()
  })

  it('maps id, name and email from id token claims', () => {
    const user = accountToUser(
      account({ idTokenClaims: { email: 'ada@acme.com', name: 'Ada Lovelace' } }),
    )
    // first/last are split from the display name when no given/family claims.
    expect(user).toEqual({
      id: 'home-1',
      email: 'ada@acme.com',
      name: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
  })

  it('derives first/last name from the given_name/family_name claims', () => {
    const user = accountToUser(
      account({ idTokenClaims: { given_name: 'Ada', family_name: 'King', name: 'Ada Lovelace' } }),
    )
    expect(user?.firstName).toBe('Ada')
    expect(user?.lastName).toBe('King')
  })

  it('splits the display name into first/last when given/family claims are absent', () => {
    const user = accountToUser(account({ idTokenClaims: { name: 'Grace Brewster Hopper' } }))
    expect(user?.firstName).toBe('Grace')
    expect(user?.lastName).toBe('Brewster Hopper')
  })

  it('falls back to preferred_username when it looks like an email', () => {
    const user = accountToUser(
      account({ idTokenClaims: { preferred_username: 'grace@navy.mil' } }),
    )
    expect(user?.email).toBe('grace@navy.mil')
  })

  it('falls back to account.username when it looks like an email', () => {
    const user = accountToUser(account({ username: 'katherine@nasa.gov' }))
    expect(user?.email).toBe('katherine@nasa.gov')
  })

  it('leaves email undefined when no source looks like an email', () => {
    const user = accountToUser(account({ username: 'not-an-email', name: 'No Mail' }))
    expect(user?.email).toBeUndefined()
    expect(user?.name).toBe('No Mail')
  })

  it('prefers the name claim but falls back to account.name', () => {
    expect(accountToUser(account({ name: 'Fallback Name' }))?.name).toBe('Fallback Name')
    expect(
      accountToUser(account({ name: 'Fallback', idTokenClaims: { name: 'Claim Name' } }))?.name,
    ).toBe('Claim Name')
  })
})
