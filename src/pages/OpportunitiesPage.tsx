import { useNavigate } from 'react-router-dom'
import { useTierList } from '../hooks/useTierList'
import { OPPORTUNITY_ORDER, OPPORTUNITY_SELECT } from '../services/opportunityApi'
import type { Opportunity } from '../types/opportunity'
import { formatCurrency, formatDate } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { CardButton } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { ListStates, LoadMore } from '../components/common/ListStates'

/**
 * Opportunities list with My / Company toggle and detail links.
 *
 * Read-only for portal customers: an opportunity is Redcentric's own sales
 * pipeline pursuing the customer, not something the customer authors (see the
 * permission model in ../dataverse-rcportal-terraform). Customers raise support
 * cases instead — see CasesPage.
 */
export function OpportunitiesPage() {
  const navigate = useNavigate()
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Opportunity>('opportunity', {
      select: OPPORTUNITY_SELECT,
      orderBy: OPPORTUNITY_ORDER,
      top: 25,
    })

  return (
    <div>
      <PageHeader
        title="Opportunities"
        subtitle={tier === 'me' ? 'Opportunities you lead' : "Your company's pipeline"}
        actions={<TierToggle tier={tier} onChange={setTier} />}
      />

      <ListStates
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyMessage={
          tier === 'me'
            ? "You're not the lead on any opportunities yet."
            : 'No opportunities for your company yet.'
        }
      >
        <div className="space-y-3">
          {items.map((o) => (
            <CardButton
              key={o.opportunityid}
              onClick={() => navigate(`/opportunities/${o.opportunityid}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-rc-navy">{o.name || 'Untitled'}</div>
                  <div className="mt-1 text-sm text-rc-teal">
                    Closes {formatDate(o.estimatedclosedate)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold text-rc-navy">
                    {formatCurrency(o.estimatedvalue)}
                  </span>
                  <StatusChip label={o.statuscode_label} />
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
