import { useQueries } from '@tanstack/react-query'
import type { DataverseClient } from '@truenorth-it/dataverse-client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useCompanyClients } from './useCompanyClients'
import { firstNumber } from '../lib/aggregate'

export interface DashboardStats {
  cases: number | null
  quotes: number | null
  projects: number | null
  sites: number | null
  opportunities: number | null
}

/** The four headline counts for one company (team tier). */
async function companyCounts(client: DataverseClient): Promise<DashboardStats> {
  const one = async (table: string) => {
    try {
      const r = await client.team.aggregate(table, { aggregate: 'count' })
      return firstNumber(r.data[0] as Record<string, unknown> | undefined)
    } catch {
      return null
    }
  }
  const [cases, quotes, projects, sites, opportunities] = await Promise.all([
    one('case'),
    one('quote'),
    one('project'),
    one('site'),
    one('opportunity'),
  ])
  return { cases, quotes, projects, sites, opportunities }
}

/**
 * Dashboard tiles — one React Query per company so TanStack caches each company
 * independently. "This company" observes just the selected company's query;
 * "All companies" observes every company and sums them via `combine`. Because
 * they share the same per-company caches, switching scope only fetches the
 * companies it hasn't seen yet, and switching back is instant.
 *
 * `stale` is true while any needed company is still loading — the tiles shimmer
 * until the full (summed) figure is ready, then reveal it.
 */
export function useDashboard(): { stats: DashboardStats; loading: boolean; stale: boolean } {
  const companyClients = useCompanyClients()
  const { currentCompany, allCompanies } = useSelectedCompany()
  const selectedId = currentCompany?.companyId

  const targets = allCompanies
    ? companyClients
    : companyClients.filter((c) => c.company.companyId === selectedId)
  const active = targets.length ? targets : companyClients.slice(0, 1)

  return useQueries({
    queries: active.map(({ company, client }) => ({
      queryKey: ['company-counts', company.companyId],
      queryFn: () => companyCounts(client),
      staleTime: 60_000,
    })),
    combine: (results) => {
      const data = results.map((r) => r.data).filter((d): d is DashboardStats => !!d)
      const sum = (k: keyof DashboardStats) => {
        const nums = data.map((d) => d[k]).filter((n): n is number => typeof n === 'number')
        return nums.length ? nums.reduce((a, b) => a + b, 0) : null
      }
      return {
        stats: {
          cases: sum('cases'),
          quotes: sum('quotes'),
          projects: sum('projects'),
          sites: sum('sites'),
          opportunities: sum('opportunities'),
        },
        loading: results.some((r) => r.isFetching),
        stale: results.some((r) => r.isPending),
      }
    },
  })
}
