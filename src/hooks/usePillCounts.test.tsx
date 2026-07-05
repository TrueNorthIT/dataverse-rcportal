import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Company, FilterCondition } from '@truenorth-it/dataverse-client'
import { hookWrapper } from '../test/render'
import { makeClient, makeCompany, count, aggregate, type MockClient } from '../test/dataverse'
import type { CountablePill } from './usePillCounts'
import { usePillCounts } from './usePillCounts'

// Single-company client for the normal path; per-company clients for fan-out.
const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client }))

let companyClients: { company: Company; client: MockClient }[] = []
vi.mock('./useCompanyClients', () => ({
  useCompanyClients: () => companyClients,
}))

let selectedCompany: { selectedContactId: string | undefined; allCompanies: boolean }
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => selectedCompany,
}))

const openFilter: FilterCondition = { field: 'statecode', operator: 'eq', value: 0 }
const closedFilter: FilterCondition = { field: 'statecode', operator: 'eq', value: 1 }

const pills: CountablePill[] = [
  { key: 'all' }, // no filter -> never counted, resolves to null
  { key: 'open', filter: openFilter },
  { key: 'closed', filter: closedFilter },
]

describe('usePillCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    companyClients = []
    selectedCompany = { selectedContactId: undefined, allCompanies: false }
  })

  it('returns an empty map before the counts resolve', () => {
    client.team.aggregate.mockReturnValue(new Promise(() => {})) // pending
    const { result } = renderHook(() => usePillCounts('case', 'team', pills), {
      wrapper: hookWrapper(),
    })
    expect(result.current).toEqual({})
  })

  it('counts each filtered pill and leaves the "all" pill null', async () => {
    client.team.aggregate.mockImplementation((_t: string, opts: { filter?: unknown }) =>
      Promise.resolve(count(opts.filter === openFilter ? 5 : 2)),
    )

    const { result } = renderHook(() => usePillCounts('case', 'team', pills), {
      wrapper: hookWrapper(),
    })

    await waitFor(() => expect(result.current.open).toBe(5))
    expect(result.current.closed).toBe(2)
    expect(result.current.all).toBeNull()
    // The unfiltered "all" pill is never counted.
    expect(client.team.aggregate).toHaveBeenCalledTimes(2)
    expect(client.team.aggregate).toHaveBeenCalledWith('case', {
      aggregate: 'count',
      filter: openFilter,
    })
  })

  it('counts on the given tier (me)', async () => {
    client.me.aggregate.mockResolvedValue(count(9))
    const { result } = renderHook(
      () => usePillCounts('case', 'me', [{ key: 'mine', filter: openFilter }]),
      { wrapper: hookWrapper() },
    )

    await waitFor(() => expect(result.current.mine).toBe(9))
    expect(client.me.aggregate).toHaveBeenCalledWith('case', {
      aggregate: 'count',
      filter: openFilter,
    })
    expect(client.team.aggregate).not.toHaveBeenCalled()
  })

  it('reports zero (not null) for a pill whose count query errors', async () => {
    // fanCount returns null on error; usePillCounts maps that to 0.
    client.team.aggregate.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(
      () => usePillCounts('case', 'team', [{ key: 'open', filter: openFilter }]),
      { wrapper: hookWrapper() },
    )

    await waitFor(() => expect(result.current.open).toBe(0))
  })

  it('reports zero when the aggregate row carries no number', async () => {
    client.team.aggregate.mockResolvedValue(aggregate([{}]))
    const { result } = renderHook(
      () => usePillCounts('case', 'team', [{ key: 'open', filter: openFilter }]),
      { wrapper: hookWrapper() },
    )

    await waitFor(() => expect(result.current.open).toBe(0))
  })

  it('does not fan out on the single-company path even with all-companies selected', async () => {
    selectedCompany = { selectedContactId: 'c1', allCompanies: true }
    const other = makeClient()
    other.team.aggregate.mockResolvedValue(count(100))
    companyClients = [{ company: makeCompany({ contactid: 'c2' }), client: other }]
    client.team.aggregate.mockResolvedValue(count(3))

    // fanOut defaults to false -> uses the single client, ignores companyClients.
    const { result } = renderHook(
      () => usePillCounts('case', 'team', [{ key: 'open', filter: openFilter }]),
      { wrapper: hookWrapper() },
    )

    await waitFor(() => expect(result.current.open).toBe(3))
    expect(other.team.aggregate).not.toHaveBeenCalled()
  })

  it('sums each pill across every company when fanOut + all-companies', async () => {
    const c1 = makeClient()
    const c2 = makeClient()
    c1.team.aggregate.mockResolvedValue(count(4))
    c2.team.aggregate.mockResolvedValue(count(6))
    companyClients = [
      { company: makeCompany({ contactid: 'c1' }), client: c1 },
      { company: makeCompany({ contactid: 'c2' }), client: c2 },
    ]
    selectedCompany = { selectedContactId: 'c1', allCompanies: true }

    const { result } = renderHook(
      () =>
        usePillCounts('case', 'team', [{ key: 'open', filter: openFilter }], {
          fanOut: true,
        }),
      { wrapper: hookWrapper() },
    )

    await waitFor(() => expect(result.current.open).toBe(10))
    expect(c1.team.aggregate).toHaveBeenCalled()
    expect(c2.team.aggregate).toHaveBeenCalled()
    // The single-company client is unused when fanning out.
    expect(client.team.aggregate).not.toHaveBeenCalled()
  })

  it('uses the single company when fanOut is on but all-companies is off', async () => {
    const other = makeClient()
    other.team.aggregate.mockResolvedValue(count(100))
    companyClients = [{ company: makeCompany({ contactid: 'c2' }), client: other }]
    selectedCompany = { selectedContactId: 'c1', allCompanies: false }
    client.team.aggregate.mockResolvedValue(count(7))

    const { result } = renderHook(
      () =>
        usePillCounts('case', 'team', [{ key: 'open', filter: openFilter }], {
          fanOut: true,
        }),
      { wrapper: hookWrapper() },
    )

    await waitFor(() => expect(result.current.open).toBe(7))
    expect(other.team.aggregate).not.toHaveBeenCalled()
  })

  it('does not fetch when disabled', () => {
    const { result } = renderHook(
      () =>
        usePillCounts('case', 'team', [{ key: 'open', filter: openFilter }], {
          enabled: false,
        }),
      { wrapper: hookWrapper() },
    )
    expect(client.team.aggregate).not.toHaveBeenCalled()
    expect(result.current).toEqual({})
  })

  it('supports an array filter for a pill', async () => {
    const arrayFilter: FilterCondition[] = [openFilter, closedFilter]
    client.team.aggregate.mockResolvedValue(count(8))

    const { result } = renderHook(
      () => usePillCounts('case', 'team', [{ key: 'both', filter: arrayFilter }]),
      { wrapper: hookWrapper() },
    )

    await waitFor(() => expect(result.current.both).toBe(8))
    expect(client.team.aggregate).toHaveBeenCalledWith('case', {
      aggregate: 'count',
      filter: arrayFilter,
    })
  })
})
