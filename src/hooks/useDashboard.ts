import { useEffect, useState } from 'react'
import type { AggregateOptions } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'

export interface DashboardStats {
  cases: number | null
  opportunities: number | null
  pipeline: number | null
  quotes: number | null
}

/** Pull the first numeric value out of an aggregate row, whatever it's keyed as. */
function firstNumber(row: Record<string, unknown> | undefined): number | null {
  if (!row) return null
  const n = Object.values(row).find((v) => typeof v === 'number')
  return typeof n === 'number' ? n : null
}

/**
 * Dashboard tiles for the `me` tier (spec §6.8): open-opportunity count,
 * pipeline value, and quote/project counts. Each aggregate is independent and
 * failure-tolerant — a table that errors just shows "—" rather than blanking
 * the whole dashboard.
 */
export function useDashboard(): { stats: DashboardStats; loading: boolean } {
  const client = useDataverseClient()
  const [stats, setStats] = useState<DashboardStats>({
    cases: null,
    opportunities: null,
    pipeline: null,
    quotes: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const agg = async (table: string, options: AggregateOptions) => {
      try {
        const res = await client.me.aggregate(table, options)
        return firstNumber(res.data[0] as Record<string, unknown> | undefined)
      } catch {
        return null
      }
    }

    void (async () => {
      setLoading(true)
      const [cases, opportunities, pipeline, quotes] = await Promise.all([
        agg('case', { aggregate: 'count' }),
        agg('opportunity', { aggregate: 'count' }),
        agg('opportunity', { aggregate: 'estimatedvalue:sum' }),
        agg('quote', { aggregate: 'count' }),
      ])
      if (!cancelled) {
        setStats({ cases, opportunities, pipeline, quotes })
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client])

  return { stats, loading }
}
