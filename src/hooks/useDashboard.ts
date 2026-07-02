import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AggregateOptions } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'

export interface DashboardStats {
  cases: number | null
  quotes: number | null
  projects: number | null
  sites: number | null
}

/** Pull the first numeric value out of an aggregate row, whatever it's keyed as. */
function firstNumber(row: Record<string, unknown> | undefined): number | null {
  if (!row) return null
  const n = Object.values(row).find((v) => typeof v === 'number')
  return typeof n === 'number' ? n : null
}

/**
 * Dashboard tiles: the caller's company at a glance — quotes, projects, and
 * sites, counted at the `team` tier (company-level assets, so every user sees
 * real numbers, not just the account's primary contact). Keyed on the selected
 * company; keeps prior numbers while refetching and refreshes on window focus.
 * Each aggregate is failure-tolerant — a table that errors just shows "—".
 */
export function useDashboard(): { stats: DashboardStats; loading: boolean } {
  const client = useDataverseClient()
  const { selectedContactId } = useSelectedCompany()

  const query = useQuery({
    queryKey: ['dashboard', selectedContactId ?? 'default'],
    queryFn: async (): Promise<DashboardStats> => {
      const agg = async (table: string, options: AggregateOptions) => {
        try {
          const res = await client.team.aggregate(table, options)
          return firstNumber(res.data[0] as Record<string, unknown> | undefined)
        } catch {
          return null
        }
      }
      const [cases, quotes, projects, sites] = await Promise.all([
        agg('case', { aggregate: 'count' }),
        agg('quote', { aggregate: 'count' }),
        agg('project', { aggregate: 'count' }),
        agg('site', { aggregate: 'count' }),
      ])
      return { cases, quotes, projects, sites }
    },
    placeholderData: keepPreviousData,
  })

  return {
    stats: query.data ?? { quotes: null, projects: null, sites: null },
    loading: query.isFetching,
  }
}
