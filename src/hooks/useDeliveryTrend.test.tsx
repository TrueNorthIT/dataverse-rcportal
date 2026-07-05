import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Company } from '@truenorth-it/dataverse-client'
import { hookWrapper } from '../test/render'
import { makeClient, makeCompany, paginated, type MockClient } from '../test/dataverse'
import type { Project } from '../types/project'
import { useDeliveryTrend } from './useDeliveryTrend'

// The single-company client (client.team) and the per-company clients used when
// rolling up "All companies" are both mocked so a test just says what rows come
// back and asserts the binned trend.
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

// Fixed "now" so month bins + labels are deterministic. July 2026.
const NOW = '2026-07-05T12:00:00Z'

describe('useDeliveryTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fake only Date (so Date.now()/labels are fixed) and leave the real timers
    // running — React Query + waitFor rely on setTimeout to advance.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
    companyClients = []
    selectedCompany = { selectedContactId: undefined, allCompanies: false }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty trend before the query resolves', () => {
    client.team.list.mockReturnValue(new Promise(() => {})) // pending
    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })
    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('builds an 8-back + current + 3-forward monthly window', async () => {
    client.team.list.mockResolvedValue(paginated<Project>([]))
    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // MONTHS_BACK (8) + current + MONTHS_FWD (3) = 12 points.
    expect(result.current.data).toHaveLength(12)
    // Current month (July 2026) is the join point: both series present.
    const july = result.current.data.find((p) => p.label === 'Jul')
    expect(july).toEqual({ label: 'Jul', delivered: 0, projected: 0 })
    // Requests only the two dates it needs, capped at 200 rows.
    expect(client.team.list).toHaveBeenCalledWith('project', {
      select: ['msdyn_finish', 'msdyn_actualend'],
      top: 200,
    })
  })

  it('accumulates real deliveries (msdyn_actualend) into the solid line', async () => {
    // Two projects delivered in June 2026 (the month before "now").
    client.team.list.mockResolvedValue(
      paginated<Project>([
        { msdyn_actualend: '2026-06-10T00:00:00Z' },
        { msdyn_actualend: '2026-06-20T00:00:00Z' },
      ]),
    )
    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    const june = result.current.data.find((p) => p.label === 'Jun')
    expect(june?.delivered).toBe(2)
    expect(june?.projected).toBeNull() // months before current: solid only
    // Cumulative: the current month carries the running total forward.
    const july = result.current.data.find((p) => p.label === 'Jul')
    expect(july?.delivered).toBe(2)
    expect(july?.projected).toBe(2)
  })

  it('folds deliveries older than the window into the opening baseline', async () => {
    // Delivered well before the visible 8-month window -> baseline, not a point.
    client.team.list.mockResolvedValue(
      paginated<Project>([{ msdyn_actualend: '2020-01-01T00:00:00Z' }]),
    )
    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // Every visible month already sits at the baseline of 1.
    const first = result.current.data[0]
    expect(first.delivered).toBe(1)
    const july = result.current.data.find((p) => p.label === 'Jul')
    expect(july?.delivered).toBe(1)
  })

  it('extends the dashed projected line with upcoming scheduled finishes', async () => {
    // A scheduled finish (no actualend) in August 2026 — one month ahead.
    client.team.list.mockResolvedValue(
      paginated<Project>([{ msdyn_finish: '2026-08-15T00:00:00Z' }]),
    )
    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    const aug = result.current.data.find((p) => p.label === 'Aug')
    expect(aug?.delivered).toBeNull() // future months: dashed only
    expect(aug?.projected).toBe(1)
  })

  it('ignores unparseable and out-of-range dates', async () => {
    client.team.list.mockResolvedValue(
      paginated<Project>([
        { msdyn_actualend: 'not-a-date' }, // NaN -> skipped
        { msdyn_actualend: '2999-01-01T00:00:00Z' }, // in the future -> skipped
        { msdyn_finish: '2020-01-01T00:00:00Z' }, // scheduled but already past -> skipped
        { msdyn_subject: 'no dates' }, // neither date -> ignored entirely
      ]),
    )
    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // Nothing counted anywhere.
    expect(result.current.data.every((p) => (p.delivered ?? 0) === 0)).toBe(true)
    const future = result.current.data.filter((p) => p.projected !== null)
    expect(future.every((p) => p.projected === 0)).toBe(true)
  })

  it('labels the January bucket with a two-digit year suffix', async () => {
    client.team.list.mockResolvedValue(paginated<Project>([]))
    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // Window starts Nov 2025 and runs to Oct 2026; Jan 2026 is inside it.
    expect(result.current.data.some((p) => p.label === 'Jan 26')).toBe(true)
  })

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useDeliveryTrend(false), { wrapper: hookWrapper() })
    expect(client.team.list).not.toHaveBeenCalled()
    expect(result.current.data).toEqual([])
  })

  it('fans out across every company and concatenates their projects when all-companies', async () => {
    const c1 = makeClient()
    const c2 = makeClient()
    c1.team.list.mockResolvedValue(
      paginated<Project>([{ msdyn_actualend: '2026-06-10T00:00:00Z' }]),
    )
    c2.team.list.mockResolvedValue(
      paginated<Project>([{ msdyn_actualend: '2026-06-11T00:00:00Z' }]),
    )
    companyClients = [
      { company: makeCompany({ contactid: 'c1' }), client: c1 },
      { company: makeCompany({ contactid: 'c2' }), client: c2 },
    ]
    selectedCompany = { selectedContactId: 'c1', allCompanies: true }

    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // Both companies' June deliveries concatenated: 2 total.
    const june = result.current.data.find((p) => p.label === 'Jun')
    expect(june?.delivered).toBe(2)
    expect(c1.team.list).toHaveBeenCalled()
    expect(c2.team.list).toHaveBeenCalled()
    // The single-company client is not used in fan-out mode.
    expect(client.team.list).not.toHaveBeenCalled()
  })

  it('treats a company that errors during fan-out as empty', async () => {
    const c1 = makeClient()
    const c2 = makeClient()
    c1.team.list.mockResolvedValue(
      paginated<Project>([{ msdyn_actualend: '2026-06-10T00:00:00Z' }]),
    )
    c2.team.list.mockRejectedValue(new Error('company down'))
    companyClients = [
      { company: makeCompany({ contactid: 'c1' }), client: c1 },
      { company: makeCompany({ contactid: 'c2' }), client: c2 },
    ]
    selectedCompany = { selectedContactId: 'c1', allCompanies: true }

    const { result } = renderHook(() => useDeliveryTrend(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // The flaky company contributes nothing; the healthy one still counts.
    const june = result.current.data.find((p) => p.label === 'Jun')
    expect(june?.delivered).toBe(1)
  })
})
