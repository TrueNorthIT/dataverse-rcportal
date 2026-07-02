import { useEffect, useState } from 'react'
import type { AggregateOptions } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'

export interface DashboardStats {
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
 * Dashboard tiles for the `me` tier (spec §6.8): open support cases, quotes,
 * projects, and sites. Each aggregate is independent and failure-tolerant — a
 * table that errors just shows "—" rather than blanking the whole dashboard.
 *
 * (Opportunities/pipeline are intentionally excluded — internal sales, not a
 * customer-facing view. See PORTAL_SPEC §5.)
 */
export function useDashboard(): { stats: DashboardStats; loading: boolean } {
  const client = useDataverseClient()
  const [stats, setStats] = useState<DashboardStats>({
    quotes: null,
    projects: null,
    sites: null,
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
      const [quotes, projects, sites] = await Promise.all([
        agg('quote', { aggregate: 'count' }),
        agg('project', { aggregate: 'count' }),
        agg('site', { aggregate: 'count' }),
      ])
      if (!cancelled) {
        setStats({ quotes, projects, sites })
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client])

  return { stats, loading }
}
