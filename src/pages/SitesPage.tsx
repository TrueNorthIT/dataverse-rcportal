import { useEffect } from 'react'
import type { OrderBy } from '@truenorth-it/dataverse-client'
import { useTierList } from '../hooks/useTierList'
import { useListControls } from '../hooks/useListControls'
import { SITE_SELECT, CONNECTIVITY_TYPES, siteConnectivity } from '../services/siteApi'
import type { Site } from '../types/site'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { FilterPills } from '../components/common/FilterPills'
import { SortMenu } from '../components/common/SortMenu'
import { ListStates, LoadMore } from '../components/common/ListStates'

const SITE_PILLS = [
  { key: 'all', label: 'All' },
  ...CONNECTIVITY_TYPES.map((c) => ({ key: c.key, label: c.label })),
]

const SITE_SORTS: { key: string; label: string; order: OrderBy }[] = [
  { key: 'name', label: 'Name (A–Z)', order: { field: 'name', direction: 'asc' } },
  { key: 'added', label: 'Recently added', order: { field: 'createdon', direction: 'desc' } },
]

/** Sites list with My / Company toggle — the customer's locations/premises. */
export function SitesPage() {
  // Sites are company-level — default to the Company tier.
  const { filter: conn, setFilter: setConn, sort, setSort } = useListControls('all', 'name')
  const activeSort = SITE_SORTS.find((s) => s.key === sort) ?? SITE_SORTS[0]
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Site>('site', { select: SITE_SELECT, orderBy: activeSort.order, top: 25 }, 'team')

  // Connectivity type is derived from the site name (demo dressing), so filter
  // client-side over the loaded rows rather than server-side.
  const visible =
    conn === 'all' ? items : items.filter((s) => siteConnectivity(s.name).key === conn)

  // Connectivity is derived, so grey out pills with no matching loaded rows.
  const present = new Set(items.map((s) => siteConnectivity(s.name).key))
  const disabledKeys =
    items.length > 0
      ? new Set(CONNECTIVITY_TYPES.filter((c) => !present.has(c.key)).map((c) => c.key))
      : new Set<string>()
  useEffect(() => {
    if (conn !== 'all' && items.length > 0 && !present.has(conn)) setConn('all')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, conn])

  return (
    <div>
      <PageHeader
        title="Sites"
        subtitle={tier === 'me' ? 'Your locations' : "Your company's locations"}
        actions={<TierToggle tier={tier} onChange={setTier} />}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FilterPills
          options={SITE_PILLS}
          value={conn}
          onChange={setConn}
          disabledKeys={disabledKeys}
        />
        <SortMenu options={SITE_SORTS} value={activeSort.key} onChange={setSort} />
      </div>

      <ListStates
        loading={loading}
        error={error}
        isEmpty={visible.length === 0}
        emptyMessage={
          conn === 'all' ? 'No sites to show yet.' : 'No sites with that connectivity.'
        }
      >
        <div className="space-y-3 rc-land-list">
          {visible.map((s) => {
            const link = siteConnectivity(s.name)
            return (
              <Card key={s.customeraddressid} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-rc-navy">{s.name || 'Site'}</div>
                    <div className="mt-1 text-sm text-rc-teal">
                      {[s.line1, s.city, s.postalcode].filter(Boolean).join(', ')}
                    </div>
                    {s.addresstypecode_label && (
                      <div className="mt-0.5 text-xs text-rc-teal/80">
                        {s.addresstypecode_label} address
                      </div>
                    )}
                  </div>
                  <span
                    title={link.full}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rc-blue-light px-2.5 py-0.5 text-xs font-medium text-rc-navy"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16" />
                    </svg>
                    {link.label}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
      </ListStates>
    </div>
  )
}
