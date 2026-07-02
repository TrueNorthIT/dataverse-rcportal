import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { getCase } from '../services/caseApi'
import { formatDate } from '../lib/format'
import { Card } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'

/** Support case detail: summary, status/priority, description, dates. */
export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const client = useDataverseClient()
  const { selectedContactId } = useSelectedCompany()

  const query = useQuery({
    queryKey: ['case', id, selectedContactId ?? 'default'],
    queryFn: () => getCase(client, id!),
    enabled: !!id,
  })
  const record = query.data ?? null
  const loading = query.isLoading
  const error = query.error instanceof Error ? query.error.message : null

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/cases')}
        className="mb-4 text-sm font-medium text-white/90 hover:underline"
      >
        ← Support
      </button>

      {loading && <p className="text-sm text-white/80">Loading…</p>}
      {error && <p className="text-sm text-red-200">{error}</p>}

      {record && (
        <Card className="overflow-hidden">
          <div className="rc-gradient h-1 w-full" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-xl font-bold text-rc-navy">
                {record.title || 'Support case'}
              </h1>
              <StatusChip label={record.statuscode_label} />
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Meta label="Case number" value={record.ticketnumber || '—'} />
              <Meta label="Priority" value={record.prioritycode_label || '—'} />
              <Meta label="Raised" value={formatDate(record.createdon)} />
            </dl>
            {record.description && (
              <div className="mt-6">
                <dt className="text-xs font-medium text-rc-teal">Details</dt>
                <p className="mt-1 whitespace-pre-wrap text-sm text-rc-navy">
                  {record.description}
                </p>
              </div>
            )}
          </div>
        </Card>
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
