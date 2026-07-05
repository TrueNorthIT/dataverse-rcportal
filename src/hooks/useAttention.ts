import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useCompanyClients } from './useCompanyClients'
import { fanCount } from '../lib/aggregate'
import { CasePrioritycode } from '../types/dataverse.generated'

/** One "needs attention" highlight for the dashboard. */
export interface AttentionItem {
  key: string
  label: string
  count: number
  to: string
  tone: 'red' | 'amber' | 'blue'
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
  const companyClients = useCompanyClients()
  const { selectedContactId, allCompanies } = useSelectedCompany()

  const query = useQuery({
    queryKey: ['attention', allCompanies ? 'all' : selectedContactId ?? 'default'],
    queryFn: async () => {
      const today = isoOffset(0)
      const weekAgo = isoOffset(-7)
      const monthAgo = isoOffset(-30)
      // "All companies" fans out and sums; otherwise a single company client.
      const targets = allCompanies ? companyClients.map((c) => c.client) : [client]
      const [overdue, staleHigh, recentQuotes] = await Promise.all([
        fanCount(targets, 'team', 'project', { aggregate: 'count', filter: { field: 'msdyn_finish', operator: 'lt', value: today } }),
        fanCount(targets, 'team', 'case', {
          aggregate: 'count',
          filter: [
            { field: 'prioritycode', operator: 'eq', value: CasePrioritycode.High },
            { field: 'createdon', operator: 'le', value: weekAgo },
          ],
        }),
        fanCount(targets, 'team', 'quote', { aggregate: 'count', filter: { field: 'createdon', operator: 'ge', value: monthAgo } }),
      ])
      return { overdue: overdue ?? 0, staleHigh: staleHigh ?? 0, recentQuotes: recentQuotes ?? 0 }
    },
    staleTime: 60_000,
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
        // Deep-link filtered to overdue + sorted by due date → most overdue first.
        to: '/projects?f=overdue&s=due',
        tone: 'red',
      })
    if (d.staleHigh > 0)
      items.push({
        key: 'stale',
        label: `${d.staleHigh} high-priority ${plural(d.staleHigh, 'ticket', 'tickets')} open over a week`,
        count: d.staleHigh,
        // High priority, oldest first → the stalest tickets surface at the top.
        to: '/cases?f=high&s=oldest',
        tone: 'amber',
      })
    if (d.recentQuotes > 0)
      items.push({
        key: 'recent',
        label: `${d.recentQuotes} new ${plural(d.recentQuotes, 'quote', 'quotes')} in the last 30 days`,
        count: d.recentQuotes,
        // Newest first → the recent quotes are already at the top.
        to: '/quotes?s=newest',
        tone: 'blue',
      })
  }

  return { items, loading: query.isFetching }
}
