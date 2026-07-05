import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { FilterCondition, OrderBy } from '@truenorth-it/dataverse-client'
import { useTierList } from '../hooks/useTierList'
import { usePillCounts } from '../hooks/usePillCounts'
import { useListControls } from '../hooks/useListControls'
import { QUOTE_SELECT } from '../services/quoteApi'
import type { Quote } from '../types/quote'
import { cleanDescription, formatCurrency, formatDate } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { CardButton } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { FilterPills } from '../components/common/FilterPills'
import { SortMenu } from '../components/common/SortMenu'
import { ListStates, LoadMore } from '../components/common/ListStates'
import { QuoteStatecode } from '../types/dataverse.generated'

interface Pill {
  key: string
  label: string
  filter?: FilterCondition | FilterCondition[]
}

const QUOTE_PILLS: Pill[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active', filter: { field: 'statecode', operator: 'eq', value: QuoteStatecode.Active } },
  { key: 'draft', label: 'Draft', filter: { field: 'statecode', operator: 'eq', value: QuoteStatecode.Draft } },
]

const QUOTE_SORTS: { key: string; label: string; order: OrderBy }[] = [
  { key: 'newest', label: 'Newest', order: { field: 'createdon', direction: 'desc' } },
  { key: 'oldest', label: 'Oldest', order: { field: 'createdon', direction: 'asc' } },
  { key: 'value', label: 'Value (high–low)', order: { field: 'totalamount', direction: 'desc' } },
]

/** Quotes list with My / Company toggle; number, total, status. */
export function QuotesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Default to the Company view (all the company's quotes); toggle to "My" to
  // filter to the signed-in contact's own.
  const { filter: status, setFilter: setStatus, sort, setSort } = useListControls('all', 'newest')
  const activeFilter = QUOTE_PILLS.find((p) => p.key === status)?.filter
  const activeSort = QUOTE_SORTS.find((s) => s.key === sort) ?? QUOTE_SORTS[0]
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Quote>(
      'quote',
      {
        select: QUOTE_SELECT,
        orderBy: activeSort.order,
        top: 25,
        filter: activeFilter,
      },
      'team',
    )

  const counts = usePillCounts('quote', tier, [...QUOTE_PILLS])
  const disabledKeys = new Set(QUOTE_PILLS.filter((p) => counts[p.key] === 0).map((p) => p.key))
  useEffect(() => {
    if (status !== 'all' && counts[status] === 0) setStatus('all')
  }, [counts, status, setStatus])

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle={tier === 'me' ? 'Your quotes' : "Your company's quotes"}
        actions={<TierToggle tier={tier} onChange={setTier} />}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FilterPills
          options={QUOTE_PILLS.map((p) => ({ key: p.key, label: p.label }))}
          value={status}
          onChange={setStatus}
          disabledKeys={disabledKeys}
        />
        <SortMenu options={QUOTE_SORTS} value={activeSort.key} onChange={setSort} />
      </div>

      <ListStates
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyMessage="No quotes to show yet."
      >
        <div className="space-y-3 rc-land-list">
          {items.map((q) => (
            <CardButton
              key={q.quoteid}
              onClick={() =>
                navigate(`/quotes/${q.quoteid}`, {
                  state: { ids: items.map((i) => i.quoteid), from: location.pathname + location.search, tier },
                })
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-rc-navy">
                    {q.name || q.quotenumber || 'Quote'}
                  </div>
                  {cleanDescription(q.description) && (
                    <p className="mt-1 line-clamp-2 text-sm text-rc-teal">
                      {cleanDescription(q.description)}
                    </p>
                  )}
                  <div className="mt-1 text-sm text-rc-teal">
                    {q.quotenumber ? `${q.quotenumber} · ` : ''}
                    {formatDate(q.createdon)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold text-rc-navy">
                    {formatCurrency(q.totalamount)}
                  </span>
                  <StatusChip label={q.statecode_label} />
                </div>
              </div>
            </CardButton>
          ))}
        </div>
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
      </ListStates>
    </div>
  )
}
