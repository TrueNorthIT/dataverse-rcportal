import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { fetchQuoteDetail, listQuoteLines } from '../services/quoteApi'
import { fetchOpportunitySummary, stripCompanySuffix } from '../services/opportunityApi'
import { cleanDescription, formatCurrency, formatDate } from '../lib/format'
import { Card } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'
import {
  DetailHeader,
  DetailNav,
  DetailStates,
  MetaGrid,
  MetaItem,
  SectionTitle,
} from '../components/detail/DetailChrome'

/** Read-only quote detail: totals, validity, notes, source opportunity, line items. */
export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const client = useDataverseClient()
  const { selectedCompanyId, currentCompany } = useSelectedCompany()
  const { tier, prevId, nextId, goPrev, goNext, goBack, backLabel } = useListNav('/quotes', id)
  // Arriving from an opportunity? Back goes there and reads as that opportunity;
  // otherwise it's the Quotes list.
  const back = backLabel ?? 'Quotes'

  const query = useQuery({
    queryKey: ['quote', id, tier ?? 'auto', selectedCompanyId ?? 'default'],
    queryFn: () => fetchQuoteDetail(client, id!, tier),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const mine = query.data?.mine ?? false
  const error = query.error instanceof Error ? query.error.message : null

  const linesQuery = useQuery({
    queryKey: ['quotelines', id, mine, selectedCompanyId ?? 'default'],
    queryFn: () => listQuoteLines(client, id!, mine),
    enabled: !!id && !!record,
  })
  const lines = linesQuery.data ?? []

  // Money model: quotes store the ex-VAT value (totalamount == sum of lines).
  // VAT isn't reliably populated in Dataverse, so derive it for display at the
  // standard UK 20% — always correct and never a confusing £0.
  const subtotal = lines.reduce((s, l) => s + (Number(l.extendedamount) || 0), 0) || Number(record?.totalamount) || 0
  const vat = subtotal * 0.2
  const gross = subtotal + vat

  const oppId = record?._opportunityid_value
  const oppQuery = useQuery({
    queryKey: ['quote-opp', oppId, mine],
    queryFn: () => fetchOpportunitySummary(client, oppId!, mine),
    enabled: !!oppId,
  })
  const opp = oppQuery.data ?? null

  return (
    <div>
      <DetailNav label={back} prevId={prevId} nextId={nextId} onPrev={goPrev} onNext={goNext} onBack={goBack} />

      <DetailStates loading={query.isLoading} error={error} onBack={goBack} backLabel={back} companyName={currentCompany?.companyName}>
      {record && (
        <DetailHeader
          icon="receipt"
          title={record.name || record.quotenumber || 'Quote'}
          trailing={<StatusChip label={record.statecode_label} />}
        >
          <MetaGrid>
            <MetaItem icon="hash" label="Quote number" value={record.quotenumber} />
            <MetaItem icon="pound" label="Value (ex VAT)" value={formatCurrency(record.totalamount)} />
            <MetaItem icon="calendar" label="Valid from" value={formatDate(record.effectivefrom)} />
            <MetaItem icon="calendar" label="Valid until" value={formatDate(record.effectiveto)} />
            <MetaItem icon="clock" label="Created" value={formatDate(record.createdon)} />
            <MetaItem icon="fileText" label="Notes" value={cleanDescription(record.description)} wide />
            {opp && (
              <MetaItem icon="link" label="Source opportunity" wide>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-rc-blue-light bg-rc-canvas px-3 py-2">
                  <span className="text-sm text-rc-navy">
                    {stripCompanySuffix(opp.name || 'Opportunity', currentCompany?.companyName)}
                  </span>
                  <span className="text-sm font-medium text-rc-teal">{formatCurrency(opp.estimatedvalue)}</span>
                </div>
              </MetaItem>
            )}
          </MetaGrid>
        </DetailHeader>
      )}

      {record && (
        <div className="mt-6">
          <SectionTitle icon="layers" count={lines.length}>Line items</SectionTitle>
          {linesQuery.isLoading ? (
            <Card className="p-5"><p className="text-sm text-rc-teal">Loading line items…</p></Card>
          ) : lines.length === 0 ? (
            <Card className="p-5"><p className="text-sm text-rc-teal">No line items on this quote.</p></Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-rc-blue-light">
                {lines.map((l) => (
                  <div key={l.quotedetailid} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-rc-navy">
                        {l.productdescription || 'Item'}
                      </div>
                      <div className="text-xs text-rc-teal">
                        {formatCurrency(l.priceperunit)} × {l.quantity ?? 1}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-rc-navy">
                      {formatCurrency(l.extendedamount)}
                    </div>
                  </div>
                ))}
                <div className="space-y-1.5 bg-rc-canvas px-4 py-3">
                  <div className="flex items-center justify-between gap-4 text-sm text-rc-teal">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-rc-teal">
                    <span>VAT (20%)</span>
                    <span>{formatCurrency(vat)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-rc-blue-light pt-1.5 text-sm font-bold text-rc-navy">
                    <span>Total (inc VAT)</span>
                    <span>{formatCurrency(gross)}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
      </DetailStates>
    </div>
  )
}
