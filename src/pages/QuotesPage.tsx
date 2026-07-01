import { useNavigate } from 'react-router-dom'
import { useTierList } from '../hooks/useTierList'
import { QUOTE_SELECT } from '../services/quoteApi'
import type { Quote } from '../types/quote'
import { formatCurrency, formatDate } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { Card, CardButton } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { ListStates, LoadMore } from '../components/common/ListStates'

/** Quotes list with My / Company toggle; each links through to its opportunity. */
export function QuotesPage() {
  const navigate = useNavigate()
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Quote>('quote', {
      select: QUOTE_SELECT,
      orderBy: { field: 'createdon', direction: 'desc' },
      top: 25,
    })

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle={tier === 'me' ? 'Quotes on your opportunities' : "Your company's quotes"}
        actions={<TierToggle tier={tier} onChange={setTier} />}
      />

      <ListStates
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyMessage="No quotes to show yet."
      >
        <div className="space-y-3">
          {items.map((q) => {
            const oppId = q._opportunityid_value
            const body = (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-rc-navy">
                    {q.name || q.quotenumber || 'Quote'}
                  </div>
                  <div className="mt-1 text-sm text-rc-teal">
                    {q.quotenumber ? `${q.quotenumber} · ` : ''}
                    {formatDate(q.createdon)}
                    {oppId && ' · View opportunity →'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold text-rc-navy">
                    {formatCurrency(q.totalamount)}
                  </span>
                  <StatusChip label={q.statuscode_label} />
                </div>
              </div>
            )
            return oppId ? (
              <CardButton
                key={q.quoteid}
                onClick={() => navigate(`/opportunities/${oppId}`)}
              >
                {body}
              </CardButton>
            ) : (
              <Card key={q.quoteid} className="p-4">
                {body}
              </Card>
            )
          })}
        </div>
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
      </ListStates>
    </div>
  )
}
