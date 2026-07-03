import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AggregateOptions } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'

/** One "needs attention" highlight for the dashboard. */
export interface AttentionItem {
  key: string
  label: string
  count: number
  to: string
  tone: 'red' | 'amber' | 'blue'
}

function firstNumber(row: Record<string, unknown> | undefined): number {
  if (!row) return 0
  const n = Object.values(row).find((v) => typeof v === 'number')
  return typeof n === 'number' ? n : 0
}

const isoOffset = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/**
 * Dashboard "needs your attention" highlights, counted at the company (team)
 * tier: overdue projects, stale high-priority tickets (open over a week), and
 * recently-received quotes. Each count is a filtered aggregate; failures resolve
 * to 0 so a flaky table just drops its row rather than breaking the section.
 */
export function useAttention(): { items: AttentionItem[]; loading: boolean } {
  const client = useDataverseClient()
  const { selectedContactId } = useSelectedCompany()

  const query = useQuery({
    queryKey: ['attention', selectedContactId ?? 'default'],
    queryFn: async () => {
      const today = isoOffset(0)
      const weekAgo = isoOffset(-7)
      const monthAgo = isoOffset(-30)
      const agg = async (table: string, options: AggregateOptions) => {
        try {
          const res = await client.team.aggregate(table, options)
          return firstNumber(res.data[0] as Record<string, unknown> | undefined)
        } catch {
          return 0
        }
      }
      const [overdue, staleHigh, recentQuotes] = await Promise.all([
        agg('project', { aggregate: 'count', filter: { field: 'msdyn_finish', operator: 'lt', value: today } }),
        agg('case', {
          aggregate: 'count',
          filter: [
            { field: 'prioritycode', operator: 'eq', value: 1 },
            { field: 'createdon', operator: 'le', value: weekAgo },
          ],
        }),
        agg('quote', { aggregate: 'count', filter: { field: 'createdon', operator: 'ge', value: monthAgo } }),
      ])
      return { overdue, staleHigh, recentQuotes }
    },
    placeholderData: keepPreviousData,
  })

  const d = query.data
  const items: AttentionItem[] = []
  if (d) {
    if (d.overdue > 0)
      items.push({
        key: 'overdue',
        label: `${d.overdue} overdue ${plural(d.overdue, 'project', 'projects')}`,
        count: d.overdue,
        to: '/projects',
        tone: 'red',
      })
    if (d.staleHigh > 0)
      items.push({
        key: 'stale',
        label: `${d.staleHigh} high-priority ${plural(d.staleHigh, 'ticket', 'tickets')} open over a week`,
        count: d.staleHigh,
        to: '/cases',
        tone: 'amber',
      })
    if (d.recentQuotes > 0)
      items.push({
        key: 'recent',
        label: `${d.recentQuotes} new ${plural(d.recentQuotes, 'quote', 'quotes')} in the last 30 days`,
        count: d.recentQuotes,
        to: '/quotes',
        tone: 'blue',
      })
  }

  return { items, loading: query.isFetching }
}
