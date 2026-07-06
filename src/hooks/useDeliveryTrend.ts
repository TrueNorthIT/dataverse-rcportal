import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useCompanyClients } from './useCompanyClients'
import type { Project } from '../types/project'

/** One month on the delivery trend. `delivered` (solid) is the cumulative count
 * of real deliveries up to & including "today"; `projected` (dashed) continues
 * it with upcoming scheduled finishes. They overlap at the current month so the
 * two lines join. */
export interface TrendPoint {
  label: string
  delivered: number | null
  projected: number | null
}

const MONTHS_BACK = 8
const MONTHS_FWD = 3

const ymKey = (d: Date) => d.getFullYear() * 12 + d.getMonth()
function monthLabel(k: number): string {
  const y = Math.floor(k / 12)
  const m = ((k % 12) + 12) % 12
  const label = new Date(y, m, 1).toLocaleDateString('en-GB', { month: 'short' })
  return m === 0 ? `${label} ${String(y).slice(2)}` : label
}

/** Bin real project dates into a monthly cumulative delivery trend. */
function buildTrend(rows: Project[], now: number): TrendPoint[] {
  const curYm = ymKey(new Date(now))
  const startYm = curYm - MONTHS_BACK
  const endYm = curYm + MONTHS_FWD

  let baseline = 0 // deliveries before the visible window
  const delivered = new Map<number, number>()
  const scheduled = new Map<number, number>()
  for (const r of rows) {
    if (r.msdyn_actualend) {
      const t = Date.parse(r.msdyn_actualend)
      if (Number.isNaN(t) || t > now) continue
      const k = ymKey(new Date(t))
      if (k < startYm) baseline++
      else delivered.set(k, (delivered.get(k) ?? 0) + 1)
    } else if (r.msdyn_finish) {
      const t = Date.parse(r.msdyn_finish)
      if (Number.isNaN(t) || t <= now) continue
      const k = ymKey(new Date(t))
      scheduled.set(k, (scheduled.get(k) ?? 0) + 1)
    }
  }

  const out: TrendPoint[] = []
  let cum = baseline
  let proj = 0
  for (let k = startYm; k <= endYm; k++) {
    cum += delivered.get(k) ?? 0
    if (k < curYm) out.push({ label: monthLabel(k), delivered: cum, projected: null })
    else if (k === curYm) {
      proj = cum
      out.push({ label: monthLabel(k), delivered: cum, projected: cum })
    } else {
      proj += scheduled.get(k) ?? 0
      out.push({ label: monthLabel(k), delivered: null, projected: proj })
    }
  }
  return out
}

/**
 * Cumulative "Deliveries by month" for the selected company (team tier), derived
 * from real project dates (`msdyn_actualend` past, `msdyn_finish` upcoming). One
 * small list read, binned client-side. Keyed on the selected company so it
 * refetches on switch.
 */
export function useDeliveryTrend(enabled = true): { data: TrendPoint[]; loading: boolean } {
  const client = useDataverseClient()
  const companyClients = useCompanyClients()
  const { selectedCompanyId, allCompanies } = useSelectedCompany()

  const query = useQuery({
    queryKey: ['delivery-trend', allCompanies ? 'all' : selectedCompanyId ?? 'default'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      // client.team scopes to the selected company; we only need the two dates.
      // "All companies" fetches each company's projects and concatenates them.
      const targets = allCompanies ? companyClients.map((c) => c.client) : [client]
      const lists = await Promise.all(
        targets.map((c) =>
          c.team
            .list<Project>('project', { select: ['msdyn_finish', 'msdyn_actualend'], top: 200 })
            .then((r) => r.data)
            .catch(() => [] as Project[]),
        ),
      )
      return lists.flat()
    },
    placeholderData: keepPreviousData,
  })

  return {
    data: query.data ? buildTrend(query.data, Date.now()) : [],
    loading: query.isFetching && !query.data,
  }
}
