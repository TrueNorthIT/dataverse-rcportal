import { ListScreen } from '../components/common/ListScreen'
import type { SortOption } from '../hooks/useList'
import { QUOTE_SELECT, QUOTE_PILLS } from '../services/quoteApi'
import type { Quote } from '../types/quote'
import { cleanDescription, formatCurrency, formatDate } from '../lib/format'
import { StatusChip } from '../components/common/StatusChip'

const QUOTE_SORTS: SortOption[] = [
  { key: 'newest', label: 'Newest', order: { field: 'createdon', direction: 'desc' } },
  { key: 'oldest', label: 'Oldest', order: { field: 'createdon', direction: 'asc' } },
  { key: 'value', label: 'Value (high–low)', order: { field: 'totalamount', direction: 'desc' } },
]

/** One quote row: name/number, description, date, total, and status. */
function QuoteRow({ quote: q }: { quote: Quote }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium text-rc-navy">{q.name || q.quotenumber || 'Quote'}</div>
        {cleanDescription(q.description) && (
          <p className="mt-1 line-clamp-2 text-sm text-rc-teal">{cleanDescription(q.description)}</p>
        )}
        <div className="mt-1 text-sm text-rc-teal">
          {q.quotenumber ? `${q.quotenumber} · ` : ''}
          {formatDate(q.createdon)}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold text-rc-navy">{formatCurrency(q.totalamount)}</span>
        <StatusChip label={q.statecode_label} />
      </div>
    </div>
  )
}

/** Quotes list with My / Company toggle; number, total, status. */
export function QuotesPage() {
  return (
    <ListScreen<Quote>
      title="Quotes"
      subtitle={{ me: 'Your quotes', team: "Your company's quotes" }}
      basePath="/quotes"
      table="quote"
      select={QUOTE_SELECT}
      pills={[...QUOTE_PILLS]}
      sorts={QUOTE_SORTS}
      defaultSort="newest"
      defaultTier="team"
      getId={(q) => q.quoteid ?? ''}
      emptyMessage="No quotes to show yet."
      renderRow={(q) => <QuoteRow quote={q} />}
    />
  )
}
