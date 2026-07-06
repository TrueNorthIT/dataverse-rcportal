import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { FilterCondition } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useCompanyClients } from './useCompanyClients'
import { fanCount } from '../lib/aggregate'
import type { Tier } from './useTierList'

/** A pill whose availability we want to check by row count. */
export interface CountablePill {
  key: string
  /** Filter that defines this pill's rows; omit for an "all" pill (never counted). */
  filter?: FilterCondition | FilterCondition[]
}

interface Opts {
  /** Roll counts up across all companies when "All companies" is selected. */
  fanOut?: boolean
  /** Skip fetching until true — used to defer dashboard charts until scrolled
   * into view, so they don't starve the visible tiles of connections. */
  enabled?: boolean
}

/**
 * Count rows for each filter pill (at the given tier / selected company) so the
 * UI can grey out pills that would return nothing, and so the dashboard charts
 * can size their segments. One count aggregate per pill with a filter; the "all"
 * pill is skipped. Errors resolve to `null` (unknown).
 *
 * `fanOut` (dashboard charts): with "All companies" selected, each pill is
 * counted across every company and summed. List pages leave it off.
 * `enabled`: gate fetching (charts fetch only once in view). Results are cached
 * for a minute so toggling scope back and forth is instant.
 */
export function usePillCounts(
  table: string,
  tier: Tier,
  pills: CountablePill[],
  { fanOut = false, enabled = true }: Opts = {},
): Record<string, number | null> {
  const client = useDataverseClient()
  const companyClients = useCompanyClients()
  const { selectedCompanyId, allCompanies } = useSelectedCompany()
  const useAll = fanOut && allCompanies

  const query = useQuery({
    queryKey: ['pillcounts', table, tier, useAll ? 'all' : selectedCompanyId ?? 'default', pills.map((p) => p.key)],
    queryFn: async () => {
      const targets = useAll ? companyClients.map((c) => c.client) : [client]
      const entries = await Promise.all(
        pills.map(async (p): Promise<[string, number | null]> => {
          if (!p.filter) return [p.key, null]
          const n = await fanCount(targets, tier, table, { aggregate: 'count', filter: p.filter })
          return [p.key, n ?? 0]
        }),
      )
      return Object.fromEntries(entries) as Record<string, number | null>
    },
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  return query.data ?? {}
}
