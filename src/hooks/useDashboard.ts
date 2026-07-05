import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useCompanyClients } from './useCompanyClients'
import { fanCount } from '../lib/aggregate'

export interface DashboardStats {
  cases: number | null
  quotes: number | null
  projects: number | null
  sites: number | null
}

/**
 * Dashboard tiles: the caller's company at a glance — quotes, projects, and
 * sites, counted at the `team` tier. When "All companies" is selected the
 * counts fan out across every company the caller belongs to and sum (each call
 * stays security-trimmed to its own company). Keyed on the scope; keeps prior
 * numbers while refetching. A table that errors everywhere just shows "—".
 */
export function useDashboard(): { stats: DashboardStats; loading: boolean; stale: boolean } {
  const client = useDataverseClient()
  const companyClients = useCompanyClients()
  const { selectedContactId, allCompanies } = useSelectedCompany()

  const query = useQuery({
    queryKey: ['dashboard', allCompanies ? 'all' : selectedContactId ?? 'default'],
    queryFn: async (): Promise<DashboardStats> => {
      const targets = allCompanies ? companyClients.map((c) => c.client) : [client]
      const [cases, quotes, projects, sites] = await Promise.all([
        fanCount(targets, 'team', 'case', { aggregate: 'count' }),
        fanCount(targets, 'team', 'quote', { aggregate: 'count' }),
        fanCount(targets, 'team', 'project', { aggregate: 'count' }),
        fanCount(targets, 'team', 'site', { aggregate: 'count' }),
      ])
      return { cases, quotes, projects, sites }
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  return {
    stats: query.data ?? { cases: null, quotes: null, projects: null, sites: null },
    loading: query.isFetching,
    // True while showing the previous scope's data as the new scope loads —
    // drives the skeleton on a scope switch.
    stale: query.isPlaceholderData,
  }
}
