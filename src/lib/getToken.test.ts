import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
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

  it('rethrows non-interaction errors without redirecting', async () => {
    instance.getActiveAccount.mockReturnValue({ homeAccountId: 'h1' })
    instance.acquireTokenSilent.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useGetToken())
    await expect(result.current()).rejects.toThrow('network')
    expect(instance.acquireTokenRedirect).not.toHaveBeenCalled()
  })
})
