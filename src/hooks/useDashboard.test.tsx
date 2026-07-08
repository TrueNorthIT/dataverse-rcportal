import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Company } from '@truenorth-it/dataverse-client'
import { hookWrapper } from '../test/render'
import { makeClient, makeCompany, count, aggregate, type MockClient } from '../test/dataverse'
import { useDashboard } from './useDashboard'

// One mock client per company; useCompanyClients returns [{ company, client }].
// We drive each company's team.aggregate to size the four headline tiles.
let companyClients: { company: Company; client: MockClient }[] = []
vi.mock('./useCompanyClients', () => ({
  useCompanyClients: () => companyClients,
}))

let selectedCompany: {
  currentCompany: Company | undefined
  allCompanies: boolean
}
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => selectedCompany,
}))

/** A company + a client whose team.aggregate returns `n` for every table. */
function companyWithCount(contactid: string, n: number) {
  const client = makeClient()
  client.team.aggregate.mockResolvedValue(count(n))
  return { company: makeCompany({ contactid }), client }
}

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    companyClients = []
    selectedCompany = { currentCompany: undefined, allCompanies: false }
  })

  it('loads the four headline counts for the selected company', async () => {
    const cc = companyWithCount('c1', 3)
    companyClients = [cc]
    selectedCompany = { currentCompany: cc.company, allCompanies: false }

    const { result } = renderHook(() => useDashboard(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.stale).toBe(false))
    expect(result.current.stats).toEqual({ cases: 3, quotes: 3, projects: 3, sites: 3, opportunities: 3 })
    expect(result.current.loading).toBe(false)
    // Five aggregate calls: one per table (case/quote/project/site/opportunity).
    expect(cc.client.team.aggregate).toHaveBeenCalledTimes(5)
    expect(cc.client.team.aggregate).toHaveBeenCalledWith('case', { aggregate: 'count' })
    expect(cc.client.team.aggregate).toHaveBeenCalledWith('opportunity', { aggregate: 'count' })
    expect(cc.client.team.aggregate).toHaveBeenCalledWith('site', { aggregate: 'count' })
  })

  it('only counts the selected company when not in all-companies mode', async () => {
    const c1 = companyWithCount('c1', 2)
    const c2 = companyWithCount('c2', 10)
    companyClients = [c1, c2]
    selectedCompany = { currentCompany: c1.company, allCompanies: false }

    const { result } = renderHook(() => useDashboard(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.stale).toBe(false))
    expect(result.current.stats.cases).toBe(2)
    // The unselected company is never queried.
    expect(c2.client.team.aggregate).not.toHaveBeenCalled()
  })

  it('sums every company when all-companies is selected', async () => {
    const c1 = companyWithCount('c1', 2)
    const c2 = companyWithCount('c2', 5)
    companyClients = [c1, c2]
    selectedCompany = { currentCompany: c1.company, allCompanies: true }

    const { result } = renderHook(() => useDashboard(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.stale).toBe(false))
    expect(result.current.stats).toEqual({ cases: 7, quotes: 7, projects: 7, sites: 7, opportunities: 7 })
    expect(c1.client.team.aggregate).toHaveBeenCalled()
    expect(c2.client.team.aggregate).toHaveBeenCalled()
  })

  it('falls back to the first company when the selection matches none', async () => {
    const c1 = companyWithCount('c1', 4)
    companyClients = [c1]
    // currentCompany points at a contact id that is not in companyClients.
    selectedCompany = {
      currentCompany: makeCompany({ contactid: 'ghost' }),
      allCompanies: false,
    }

    const { result } = renderHook(() => useDashboard(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.stale).toBe(false))
    // Fell back to the first company's counts rather than showing nothing.
    expect(result.current.stats.cases).toBe(4)
    expect(c1.client.team.aggregate).toHaveBeenCalled()
  })

  it('reports a null count for a table whose aggregate errors', async () => {
    const client = makeClient()
    // case errors -> null; the other tables still resolve to 1.
    client.team.aggregate.mockImplementation((table: string) =>
      table === 'case' ? Promise.reject(new Error('boom')) : Promise.resolve(count(1)),
    )
    const cc = { company: makeCompany({ contactid: 'c1' }), client }
    companyClients = [cc]
    selectedCompany = { currentCompany: cc.company, allCompanies: false }

    const { result } = renderHook(() => useDashboard(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.stale).toBe(false))
    expect(result.current.stats.cases).toBeNull()
    expect(result.current.stats.quotes).toBe(1)
  })

  it('reports null for a count when the aggregate row has no number', async () => {
    const client = makeClient()
    // An empty aggregate row -> firstNumber returns null.
    client.team.aggregate.mockResolvedValue(aggregate([{}]))
    const cc = { company: makeCompany({ contactid: 'c1' }), client }
    companyClients = [cc]
    selectedCompany = { currentCompany: cc.company, allCompanies: false }

    const { result } = renderHook(() => useDashboard(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.stale).toBe(false))
    expect(result.current.stats).toEqual({
      cases: null,
      quotes: null,
      projects: null,
      sites: null,
      opportunities: null,
    })
  })

  it('is stale (still loading) while the aggregate is pending', () => {
    const client = makeClient()
    client.team.aggregate.mockReturnValue(new Promise(() => {})) // never resolves
    const cc = { company: makeCompany({ contactid: 'c1' }), client }
    companyClients = [cc]
    selectedCompany = { currentCompany: cc.company, allCompanies: false }

    const { result } = renderHook(() => useDashboard(), { wrapper: hookWrapper() })

    expect(result.current.stale).toBe(true)
    expect(result.current.loading).toBe(true)
  })

  it('handles having no companies at all without throwing', async () => {
    companyClients = []
    selectedCompany = { currentCompany: undefined, allCompanies: false }

    const { result } = renderHook(() => useDashboard(), { wrapper: hookWrapper() })

    // No queries -> nothing pending/fetching, and every tile sums to null.
    await waitFor(() => expect(result.current.stale).toBe(false))
    expect(result.current.stats).toEqual({
      cases: null,
      quotes: null,
      projects: null,
      sites: null,
      opportunities: null,
    })
    expect(result.current.loading).toBe(false)
  })
})
