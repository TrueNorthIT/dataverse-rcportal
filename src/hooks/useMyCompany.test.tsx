import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { hookWrapper } from '../test/render'
import { makeClient, paginated, type MockClient } from '../test/dataverse'
import type { Account } from '../types/account'
import { ACCOUNT_SELECT } from '../services/accountApi'
import { useMyCompany } from './useMyCompany'

// The hook reads its client + selected company from these modules; mocking them
// lets a test drive exactly what the account list returns.
const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client }))

const selected = { selectedContactId: undefined as string | undefined }
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => selected,
}))

const account: Account = {
  accountid: 'a-1',
  name: 'Acme Ltd',
  telephone1: '01234 567890',
}

describe('useMyCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selected.selectedContactId = undefined
  })

  it('starts loading before the account resolves', () => {
    client.team.list.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useMyCompany(), { wrapper: hookWrapper() })

    expect(result.current.loading).toBe(true)
    expect(result.current.account).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('reads the caller\'s own account from the TEAM tier', async () => {
    client.team.list.mockResolvedValue(paginated<Account>([account]))

    const { result } = renderHook(() => useMyCompany(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.account).toEqual(account)
    expect(result.current.error).toBeNull()
    // Uses team (not me), asks for the tight account column set, top 1.
    expect(client.team.list).toHaveBeenCalledWith('account', {
      select: ACCOUNT_SELECT,
      top: 1,
    })
    expect(client.me.list).not.toHaveBeenCalled()
  })

  it('returns null when the caller has no account row', async () => {
    client.team.list.mockResolvedValue(paginated<Account>([]))

    const { result } = renderHook(() => useMyCompany(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.account).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('surfaces the error message when the read fails', async () => {
    client.team.list.mockRejectedValue(new Error('account boom'))

    const { result } = renderHook(() => useMyCompany(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.error).toBe('account boom'))
    expect(result.current.account).toBeNull()
  })

  it('takes only the first row when several are returned', async () => {
    const second: Account = { accountid: 'a-2', name: 'Beta Ltd' }
    client.team.list.mockResolvedValue(paginated<Account>([account, second]))

    const { result } = renderHook(() => useMyCompany(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.account).toEqual(account))
  })

  it('keeps the previous company visible while switching (keepPreviousData)', async () => {
    client.team.list.mockResolvedValue(paginated<Account>([account]))

    const { result, rerender } = renderHook(() => useMyCompany(), {
      wrapper: hookWrapper(),
    })
    await waitFor(() => expect(result.current.account).toEqual(account))

    // Switch company: the new key holds the pending fetch...
    const other: Account = { accountid: 'a-9', name: 'Zeta Ltd' }
    let resolveNext: (v: ReturnType<typeof paginated<Account>>) => void = () => {}
    client.team.list.mockReturnValue(
      new Promise((resolve) => {
        resolveNext = resolve
      }),
    )
    selected.selectedContactId = 'other-co'
    rerender()

    // ...and keepPreviousData keeps the old company visible (never blanks to null).
    expect(result.current.account).toEqual(account)

    // Let the new key resolve and confirm it swaps in.
    resolveNext(paginated<Account>([other]))
    await waitFor(() => expect(result.current.account).toEqual(other))
  })
})
