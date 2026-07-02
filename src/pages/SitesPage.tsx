import { useTierList } from '../hooks/useTierList'
import { SITE_ORDER, SITE_SELECT } from '../services/siteApi'
import type { Site } from '../types/site'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { ListStates, LoadMore } from '../components/common/ListStates'

/** Sites list with My / Company toggle — the customer's locations/premises. */
export function SitesPage() {
  // Sites are company-level — default to the Company tier.
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Site>('site', { select: SITE_SELECT, orderBy: SITE_ORDER, top: 25 }, 'team')

  return (
    <div>
      <PageHeader
        title="Sites"
        subtitle={tier === 'me' ? 'Your locations' : "Your company's locations"}
        actions={<TierToggle tier={tier} onChange={setTier} />}
      />

      <ListStates
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyMessage="No sites to show yet."
      >
        <div className="space-y-3 rc-land-list">
          {items.map((s) => (
            <Card key={s.customeraddressid} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-rc-navy">{s.name || 'Site'}</div>
                  <div className="mt-1 text-sm text-rc-teal">
                    {[s.line1, s.city, s.postalcode].filter(Boolean).join(', ')}
                  </div>
                </div>
                {s.addresstypecode_label && <StatusChip label={s.addresstypecode_label} />}
              </div>
            </Card>
          ))}
        </div>
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
      </ListStates>
    </div>
  )
}
