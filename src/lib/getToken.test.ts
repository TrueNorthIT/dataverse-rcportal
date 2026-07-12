import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { BrowserAuthError, InteractionRequiredAuthError } from '@azure/msal-browser'
import { useGetToken } from './getToken'

const instance = {
  getActiveAccount: vi.fn(),
  acquireTokenSilent: vi.fn(),
  acquireTokenRedirect: vi.fn(),
}
const accounts: unknown[] = []
vi.mock('@azure/msal-react', () => ({ useMsal: () => ({ instance, accounts }) }))

describe('useGetToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    accounts.length = 0
  })

  it('returns a fresh access token acquired silently', async () => {
    instance.getActiveAccount.mockReturnValue({ homeAccountId: 'h1' })
    instance.acquireTokenSilent.mockResolvedValue({ accessToken: 'tok-123' })

    const { result } = renderHook(() => useGetToken())
    await expect(result.current()).resolves.toBe('tok-123')
    expect(instance.acquireTokenSilent).toHaveBeenCalledWith({
      scopes: ['api://test/access_as_user'],
      account: { homeAccountId: 'h1' },
    })
  })

  it('throws when nobody is signed in', async () => {
    instance.getActiveAccount.mockReturnValue(null)
    const { result } = renderHook(() => useGetToken())
    await expect(result.current()).rejects.toThrow('Not signed in')
  })

  it('falls back to a redirect when interaction is required', async () => {
    instance.getActiveAccount.mockReturnValue({ homeAccountId: 'h1' })
    instance.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'corr-1'),
    )
    instance.acquireTokenRedirect.mockResolvedValue(undefined)

    const { result } = renderHook(() => useGetToken())
    await expect(result.current()).rejects.toBeInstanceOf(InteractionRequiredAuthError)
    expect(instance.acquireTokenRedirect).toHaveBeenCalled()
  })

  it('falls back to a redirect when the silent-renewal iframe times out', async () => {
    // MSAL v5 rejects a spent hidden-iframe renewal with BrowserAuthError
    // `timed_out` (blocked third-party cookies / dead session), NOT an
    // InteractionRequiredAuthError. That's the "next day, nothing loads" case.
    instance.getActiveAccount.mockReturnValue({ homeAccountId: 'h1' })
    instance.acquireTokenSilent.mockRejectedValue(
      new BrowserAuthError('timed_out', 'corr-2', 'redirect_bridge_timeout'),
    )
    instance.acquireTokenRedirect.mockResolvedValue(undefined)

    const { result } = renderHook(() => useGetToken())
    await expect(result.current()).rejects.toBeInstanceOf(BrowserAuthError)
    expect(instance.acquireTokenRedirect).toHaveBeenCalled()
  })

  it('does not redirect on unrelated BrowserAuthErrors', async () => {
    // e.g. an interaction is already in progress — redirecting again would loop.
    instance.getActiveAccount.mockReturnValue({ homeAccountId: 'h1' })
    instance.acquireTokenSilent.mockRejectedValue(
      new BrowserAuthError('interaction_in_progress', 'corr-3'),
    )

    const { result } = renderHook(() => useGetToken())
    await expect(result.current()).rejects.toBeInstanceOf(BrowserAuthError)
    expect(instance.acquireTokenRedirect).not.toHaveBeenCalled()
  })

  it('rethrows non-interaction errors without redirecting', async () => {
    instance.getActiveAccount.mockReturnValue({ homeAccountId: 'h1' })
    instance.acquireTokenSilent.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useGetToken())
    await expect(result.current()).rejects.toThrow('network')
    expect(instance.acquireTokenRedirect).not.toHaveBeenCalled()
  })
})
