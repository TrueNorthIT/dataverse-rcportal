import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { hookWrapper } from '../test/render'
import { count, makeClient, type MockClient } from '../test/dataverse'
import { useAttention } from './useAttention'

// The hook resolves its client, selected company and per-company clients through
// these modules; mocking them lets a test drive exactly what each count returns.
const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client }))

const selected = { selectedCompanyId: undefined as string | undefined, allCompanies: false }
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => selected,
}))

// The all-companies roll-up fans out over these clients; default is empty so the
// single-company path (the base client) is used unless a test overrides it.
let companyClients: { client: MockClient }[] = []
vi.mock('./useCompanyClients', () => ({
  useCompanyClients: () => companyClients,
}))

/**
 * Point `client.team.aggregate` at per-table counts. useAttention issues three
 * aggregates against different tables (project / case / quote), all on the team
 * tier — so we key the stub on the table argument.
 */
function stubCounts(counts: { project?: number; case?: number; quote?: number }) {
  client.team.aggregate.mockImplementation((table: string) => {
    const n =
      table === 'project'
        ? counts.project ?? 0
        : table === 'case'
          ? counts.case ?? 0
          : counts.quote ?? 0
    return Promise.resolve(count(n))
  })
}

describe('useAttention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fake ONLY Date so isoOffset() is deterministic while leaving setTimeout /
    // setInterval real — waitFor and React Query's scheduler poll normally.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
    selected.selectedCompanyId = undefined
    selected.allCompanies = false
    companyClients = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in a loading state (isFetching) on first render', () => {
    client.team.aggregate.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    expect(result.current.loading).toBe(true)
    expect(result.current.items).toEqual([])
  })

  it('shows no highlights when every count is zero', async () => {
    stubCounts({ project: 0, case: 0, quote: 0 })

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
  })

  it('builds the overdue-projects highlight (red, pluralised, deep-linked)', async () => {
    stubCounts({ project: 3 })

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.items).toHaveLength(1))
    const item = result.current.items[0]
    expect(item).toEqual({
      key: 'overdue',
      label: '3 overdue projects',
      count: 3,
      to: '/projects?f=overdue&s=due',
      tone: 'red',
    })
  })

  it('uses the singular noun when a count is exactly one', async () => {
    stubCounts({ project: 1, case: 1, quote: 1 })

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.items).toHaveLength(3))
    expect(result.current.items.map((i) => i.label)).toEqual([
      '1 overdue project',
      '1 high-priority ticket open over a week',
      '1 new quote in the last 30 days',
    ])
  })

  it('builds the stale high-priority tickets highlight (amber)', async () => {
    stubCounts({ case: 5 })

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.items[0]).toEqual({
      key: 'stale',
      label: '5 high-priority tickets open over a week',
      count: 5,
      to: '/cases?f=high&s=oldest',
      tone: 'amber',
    })
  })

  it('builds the recent-quotes highlight (blue)', async () => {
    stubCounts({ quote: 2 })

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.items[0]).toEqual({
      key: 'recent',
      label: '2 new quotes in the last 30 days',
      count: 2,
      to: '/quotes?s=newest',
      tone: 'blue',
    })
  })

  it('emits all three highlights in a stable order', async () => {
    stubCounts({ project: 4, case: 6, quote: 9 })

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.items).toHaveLength(3))
    expect(result.current.items.map((i) => i.key)).toEqual(['overdue', 'stale', 'recent'])
  })

  it('queries the correct tables/tiers with today/week/month date filters', async () => {
    stubCounts({ project: 1, case: 1, quote: 1 })

    renderHook(() => useAttention(), { wrapper: hookWrapper() })
    await waitFor(() => expect(client.team.aggregate).toHaveBeenCalledTimes(3))

    // System clock is fixed at 2026-07-05, so the offsets are deterministic.
    expect(client.team.aggregate).toHaveBeenCalledWith('project', {
      aggregate: 'count',
      filter: [
        { field: 'msdyn_finish', operator: 'lt', value: '2026-07-05' },
        { field: 'msdyn_actualend', operator: 'eq', value: 'null' },
      ],
    })
    expect(client.team.aggregate).toHaveBeenCalledWith('case', {
      aggregate: 'count',
      filter: [
        { field: 'prioritycode', operator: 'eq', value: 1 },
        { field: 'createdon', operator: 'le', value: '2026-06-28' },
      ],
    })
    expect(client.team.aggregate).toHaveBeenCalledWith('quote', {
      aggregate: 'count',
      filter: { field: 'createdon', operator: 'ge', value: '2026-06-05' },
    })
  })

  it('drops a row rather than breaking when a single count errors (resolves to 0)', async () => {
    client.team.aggregate.mockImplementation((table: string) => {
      if (table === 'project') return Promise.reject(new Error('flaky table'))
      return Promise.resolve(count(2))
    })

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // Project errored -> no overdue row; case + quote still surface.
    expect(result.current.items.map((i) => i.key)).toEqual(['stale', 'recent'])
  })

  it('coalesces every null count to 0 (no highlights) when all tables error', async () => {
    client.team.aggregate.mockRejectedValue(new Error('everything is down'))

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // fanCount returns null for each table -> `?? 0` -> no rows, section survives.
    expect(result.current.items).toEqual([])
  })

  it('fans out across every company client when allCompanies is set', async () => {
    selected.allCompanies = true
    const a = makeClient()
    const b = makeClient()
    a.team.aggregate.mockResolvedValue(count(2))
    b.team.aggregate.mockResolvedValue(count(3))
    companyClients = [{ client: a }, { client: b }]

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.items).toHaveLength(3))
    // Sums across both companies: 2 + 3 = 5 for each highlight.
    expect(result.current.items.map((i) => i.count)).toEqual([5, 5, 5])
    // The single base client is not used in all-companies mode.
    expect(client.team.aggregate).not.toHaveBeenCalled()
    expect(a.team.aggregate).toHaveBeenCalledTimes(3)
    expect(b.team.aggregate).toHaveBeenCalledTimes(3)
  })

  it('clears the loading flag once data has landed', async () => {
    stubCounts({ project: 1 })

    const { result } = renderHook(() => useAttention(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.loading).toBe(false)
    expect(result.current.stale).toBe(false)
  })
})
