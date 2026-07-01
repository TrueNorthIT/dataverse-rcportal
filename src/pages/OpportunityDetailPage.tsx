import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDataverseClient } from '../lib/client'
import { getOpportunity } from '../services/opportunityApi'
import { listQuotesForOpportunity } from '../services/quoteApi'
import type { Opportunity } from '../types/opportunity'
import type { Quote } from '../types/quote'
import { formatCurrency, formatDate } from '../lib/format'
import { Card } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'

/** Opportunity detail: headline fields + the quotes raised against it. */
export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const client = useDataverseClient()

  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [o, q] = await Promise.all([
          getOpportunity(client, id),
          listQuotesForOpportunity(client, id).catch(() => [] as Quote[]),
        ])
        if (!cancelled) {
          setOpp(o)
          setQuotes(q)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load opportunity')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client, id])

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/opportunities')}
        className="mb-4 text-sm font-medium text-rc-blue hover:underline"
      >
        ← Opportunities
      </button>

      {loading && <p className="text-sm text-rc-teal">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {opp && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="rc-gradient h-1 w-full" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-xl font-bold text-rc-navy">
                  {opp.name || 'Untitled opportunity'}
                </h1>
                <StatusChip label={opp.statuscode_label} />
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Meta label="Estimated value" value={formatCurrency(opp.estimatedvalue)} />
                <Meta label="Estimated close" value={formatDate(opp.estimatedclosedate)} />
                <Meta label="Created" value={formatDate(opp.createdon)} />
              </dl>
            </div>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-bold text-rc-navy">Quotes</h2>
            {quotes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-rc-blue-light bg-white p-6 text-center text-sm text-rc-teal">
                No quotes on this opportunity yet.
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((q) => (
                  <Card key={q.quoteid} className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium text-rc-navy">
                        {q.name || q.quotenumber || 'Quote'}
                      </div>
                      {q.quotenumber && (
                        <div className="text-xs text-rc-teal">{q.quotenumber}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-rc-navy">
                        {formatCurrency(q.totalamount)}
                      </span>
                      <StatusChip label={q.statuscode_label} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-rc-teal">{label}</dt>
      <dd className="mt-0.5 text-sm text-rc-navy">{value}</dd>
    </div>
  )
}
