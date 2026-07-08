import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { fetchOpportunityDetail } from '../services/opportunityApi'
import { listQuotesForOpportunity } from '../services/quoteApi'
import type { Opportunity } from '../types/dataverse.generated'
import { cleanDescription, formatCurrency, formatDate } from '../lib/format'
import { Card, CardButton } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'
import { Icon } from '../components/common/Icon'
import {
  DetailHeader,
  DetailNav,
  DetailStates,
  MetaGrid,
  MetaItem,
  SectionTitle,
} from '../components/detail/DetailChrome'

/** A one-line summary for the opportunity header — its status plus the headline
 *  value and expected close, so the title area reads richly at a glance. */
function opportunitySubtitle(o: Opportunity): string | undefined {
  const bits: string[] = []
  if (o.estimatedvalue != null) bits.push(`estimated ${formatCurrency(o.estimatedvalue)}`)
  if (o.estimatedclosedate) bits.push(`expected to close ${formatDate(o.estimatedclosedate)}`)
  const status = o.statuscode_label || o.statecode_label
  return [status, bits.join(' · ')].filter(Boolean).join(' — ') || undefined
}

/** Opportunity names are often seeded with a "— <company>" tail, but the portal
 *  is already acting as that company, so drop the redundant suffix. */
function stripCompanySuffix(name: string, company?: string | null): string {
  if (!company) return name
  const trimmed = name.trimEnd()
  const co = company.trim()
  if (trimmed.toLowerCase().endsWith(co.toLowerCase())) {
    const head = trimmed.slice(0, trimmed.length - co.length).replace(/[\s—–-]+$/, '')
    if (head) return head
  }
  return name
}

/** Read-only opportunity detail: value, close date, notes, and its quotes. */
export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const client = useDataverseClient()
  const { selectedCompanyId, currentCompany } = useSelectedCompany()
  const { tier, prevId, nextId, goPrev, goNext, goBack } = useListNav('/opportunities', id)

  const query = useQuery({
    queryKey: ['opportunity', id, tier ?? 'auto', selectedCompanyId ?? 'default'],
    queryFn: () => fetchOpportunityDetail(client, id!, tier),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const mine = query.data?.mine ?? false
  const error = query.error instanceof Error ? query.error.message : null
  // Drop the redundant "— <company>" tail: we're already acting as that company.
  const displayName = stripCompanySuffix(record?.name || 'Untitled opportunity', currentCompany?.companyName)

  const quotesQuery = useQuery({
    queryKey: ['opportunity-quotes', id, mine, selectedCompanyId ?? 'default'],
    queryFn: () => listQuotesForOpportunity(client, id!, mine),
    enabled: !!id && !!record,
  })
  const quotes = quotesQuery.data ?? []

  return (
    <div>
      <DetailNav label="Opportunities" prevId={prevId} nextId={nextId} onPrev={goPrev} onNext={goNext} onBack={goBack} />

      <DetailStates loading={query.isLoading} error={error} onBack={goBack} backLabel="Opportunities" companyName={currentCompany?.companyName}>
      {record && (
        <DetailHeader
          icon="activity"
          title={displayName}
          subtitle={opportunitySubtitle(record)}
          trailing={<StatusChip label={record.statuscode_label} />}
        >
          <MetaGrid>
            <MetaItem icon="pound" label="Estimated value" value={formatCurrency(record.estimatedvalue)} />
            <MetaItem icon="calendar" label="Estimated close" value={formatDate(record.estimatedclosedate)} />
            <MetaItem icon="flag" label="Status" value={record.statecode_label} />
            <MetaItem icon="clock" label="Created" value={formatDate(record.createdon)} />
            <MetaItem icon="clock" label="Last updated" value={formatDate(record.modifiedon)} />
          </MetaGrid>

          {cleanDescription(record.description) && (
            <div className="mt-6">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-rc-teal">
                <Icon name="fileText" className="h-3.5 w-3.5" /> Notes
              </dt>
              <p className="mt-1 whitespace-pre-wrap text-sm text-rc-navy">
                {cleanDescription(record.description)}
              </p>
            </div>
          )}
        </DetailHeader>
      )}

      {record && (
        <div className="mt-6">
          <SectionTitle icon="receipt" count={quotes.length}>Quotes</SectionTitle>
          {quotesQuery.isLoading ? (
            <Card className="p-5"><p className="text-sm text-rc-teal">Loading quotes…</p></Card>
          ) : quotes.length === 0 ? (
            <Card className="p-5"><p className="text-sm text-rc-teal">No quotes on this opportunity yet.</p></Card>
          ) : (
            <div className="space-y-3">
              {quotes.map((q) => (
                <CardButton
                  key={q.quoteid}
                  onClick={() =>
                    navigate(`/quotes/${q.quoteid}`, {
                      state: {
                        from: `/opportunities/${id}`,
                        fromLabel: displayName,
                        tier: mine ? 'me' : 'team',
                      },
                    })
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-rc-navy">
                        {q.name || q.quotenumber || 'Quote'}
                      </div>
                      {q.quotenumber && <div className="text-xs text-rc-teal">{q.quotenumber}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-rc-navy">{formatCurrency(q.totalamount)}</span>
                      <StatusChip label={q.statecode_label} />
                    </div>
                  </div>
                </CardButton>
              ))}
            </div>
          )}
        </div>
      )}
      </DetailStates>
    </div>
  )
}
