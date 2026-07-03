import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { FilterCondition } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import type { Tier } from './useTierList'

/** A pill whose availability we want to check by row count. */
export interface CountablePill {
  key: string
  /** Filter that defines this pill's rows; omit for an "all" pill (never counted). */
  filter?: FilterCondition | FilterCondition[]
}

/** Pull the first numeric value out of an aggregate row, whatever it's keyed as. */
function firstNumber(row: Record<string, unknown> | undefined): number | null {
  if (!row) return null
  const n = Object.values(row).find((v) => typeof v === 'number')
  return typeof n === 'number' ? n : null
}

/**
 * Count rows for each filter pill (at the given tier / selected company) so the
 * UI can grey out pills that would return nothing. One count aggregate per pill
 * with a filter; the "all" pill is skipped. Errors resolve to `null` (unknown)
 * so a failed count never wrongly disables a pill.
 *
 * Returns a map of pill key → count | null. Keyed on tier + company so it
 * refetches when either changes.
 */
export function usePillCounts(
  table: string,
  tier: Tier,
  pills: CountablePill[],
): Record<string, number | null> {
  const client = useDataverseClient()
  const { selectedContactId } = useSelectedCompany()

  const query = useQuery({
    queryKey: ['pillcounts', table, tier, selectedContactId ?? 'default', pills.map((p) => p.key)],
    queryFn: async () => {
      const entries = await Promise.all(
        pills.map(async (p): Promise<[string, number | null]> => {
          if (!p.filter) return [p.key, null]
          try {
            const res = await client[tier].aggregate(table, { aggregate: 'count', filter: p.filter })
            return [p.key, firstNumber(res.data[0] as Record<string, unknown> | undefined) ?? 0]
          } catch {
            return [p.key, null]
          }
        }),
      )
      return Object.fromEntries(entries) as Record<string, number | null>
    },
    placeholderData: keepPreviousData,
  })

  return query.data ?? {}
}
