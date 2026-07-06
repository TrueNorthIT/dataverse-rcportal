import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { hookWrapper } from '../test/render'
import { makeClient, paginated, type MockClient } from '../test/dataverse'
import { useTierList } from './useTierList'

// The hook resolves its client + selected company through these two modules;
// mocking them lets a test drive exactly what the API returns.
const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({ selectedCompanyId: undefined }),
}))

interface Row {
  id: string
}

describe('useTierList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the "me" tier by default and exposes the rows', async () => {
    client.me.list.mockResolvedValue(paginated<Row>([{ id: 'a' }, { id: 'b' }]))

    const { result } = renderHook(() => useTierList<Row>('project'), {
      wrapper: hookWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tier).toBe('me')
    expect(result.current.items).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(client.me.list).toHaveBeenCalledWith('project', undefined)
  })

  it('switches tier and refetches from the team scope', async () => {
    client.me.list.mockResolvedValue(paginated<Row>([{ id: 'mine' }]))
    client.team.list.mockResolvedValue(paginated<Row>([{ id: 'ours' }]))

    const { result } = renderHook(() => useTierList<Row>('project'), {
      wrapper: hookWrapper(),
    })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'mine' }]))

    act(() => result.current.setTier('team'))

    await waitFor(() => expect(result.current.items).toEqual([{ id: 'ours' }]))
    expect(result.current.tier).toBe('team')
  })

  it('follows the page.next cursor when loading more', async () => {
    client.me.list.mockResolvedValue(paginated<Row>([{ id: 'p1' }], 'next-url'))
    client.me.fetchPage.mockResolvedValue(paginated<Row>([{ id: 'p2' }]))

    const { result } = renderHook(() => useTierList<Row>('project'), {
      wrapper: hookWrapper(),
    })
    await waitFor(() => expect(result.current.hasMore).toBe(true))

    act(() => result.current.loadMore())

    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p1' }, { id: 'p2' }]))
    expect(client.me.fetchPage).toHaveBeenCalledWith('next-url')
    expect(result.current.hasMore).toBe(false)
  })

  it('surfaces the error message when a list request fails', async () => {
    client.me.list.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useTierList<Row>('project'), {
      wrapper: hookWrapper(),
    })

    await waitFor(() => expect(result.current.error).toBe('boom'))
  })
})
