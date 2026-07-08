import { ListScreen } from '../components/common/ListScreen'
import type { SortOption } from '../hooks/useList'
import { OPPORTUNITY_SELECT, OPPORTUNITY_PILLS, stripCompanySuffix } from '../services/opportunityApi'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import type { Opportunity } from '../types/dataverse.generated'
import { cleanDescription, formatCurrency, formatDate } from '../lib/format'
import { StatusChip } from '../components/common/StatusChip'

const OPPORTUNITY_SORTS: SortOption[] = [
  { key: 'closing', label: 'Closing soon', order: { field: 'estimatedclosedate', direction: 'asc' } },
  { key: 'newest', label: 'Newest', order: { field: 'createdon', direction: 'desc' } },
  { key: 'value', label: 'Value (high–low)', order: { field: 'estimatedvalue', direction: 'desc' } },
]

/** One opportunity row: name, description, close date, value, and state. */
function OpportunityRow({ opp: o, company }: { opp: Opportunity; company?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium text-rc-navy">
          {stripCompanySuffix(o.name || 'Untitled opportunity', company)}
        </div>
        {cleanDescription(o.description) && (
          <p className="mt-1 line-clamp-2 text-sm text-rc-teal">{cleanDescription(o.description)}</p>
        )}
        <div className="mt-1 text-sm text-rc-teal">Closes {formatDate(o.estimatedclosedate)}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold text-rc-navy">{formatCurrency(o.estimatedvalue)}</span>
        <StatusChip label={o.statecode_label} />
      </div>
    </div>
  )
}

/**
 * Opportunities list with My / Company toggle; value, close date, state.
 * Read-only for customers — opportunities are viewed, never authored, in the
 * portal (see opportunityApi).
 */
export function OpportunitiesPage() {
  const { currentCompany } = useSelectedCompany()
  return (
    <ListScreen<Opportunity>
      title="Opportunities"
      subtitle={{ me: 'Opportunities you lead', team: "Your company's pipeline" }}
      basePath="/opportunities"
      table="opportunity"
      select={OPPORTUNITY_SELECT}
      pills={[...OPPORTUNITY_PILLS]}
      sorts={OPPORTUNITY_SORTS}
      defaultSort="closing"
      defaultTier="team"
      getId={(o) => o.opportunityid ?? ''}
      emptyMessage="No opportunities to show yet."
      renderRow={(o) => <OpportunityRow opp={o} company={currentCompany?.companyName} />}
    />
  )
}
