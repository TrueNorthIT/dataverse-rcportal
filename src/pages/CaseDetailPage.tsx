import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { fetchCaseDetail, listCaseNotes } from '../services/caseApi'
import { cleanDescription, formatDate, relativeFromNow } from '../lib/format'
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
    queryFn: () => fetchCaseDetail(client, id!),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const mine = query.data?.mine ?? true
  const loading = query.isLoading
  const error = query.error instanceof Error ? query.error.message : null

  // Notes timeline — only once we know the case (and which tier resolved it).
  const notesQuery = useQuery({
    queryKey: ['casenotes', id, mine, selectedContactId ?? 'default'],
    queryFn: () => listCaseNotes(client, id!, mine),
    enabled: !!id && !!record,
  })
  const notes = notesQuery.data ?? []

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
              <h1 className="text-2xl font-normal tracking-tight text-rc-navy">
                {record.title || 'Support case'}
              </h1>
              <StatusChip label={record.statuscode_label} />
            </div>
            {!mine && (
              <div className="mt-3 rounded-lg border border-rc-blue-light bg-rc-canvas px-3 py-2 text-xs text-rc-teal">
                This is one of your company's tickets — raised by a colleague, so
                it's shown read-only.
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Meta label="Case number" value={record.ticketnumber || '—'} />
              <Meta label="Priority" value={record.prioritycode_label || '—'} />
              <Meta label="Raised" value={formatDate(record.createdon)} />
              <Meta label="Last updated" value={relativeFromNow(record.modifiedon)} />
            </dl>
            {cleanDescription(record.description) && (
              <div className="mt-6">
                <dt className="text-xs font-medium text-rc-teal">Details</dt>
                <p className="mt-1 whitespace-pre-wrap text-sm text-rc-navy">
                  {cleanDescription(record.description)}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {record && (
        <div className="mt-6">
          <h2 className="mb-3 text-xl font-light tracking-tight text-white">Updates</h2>
          {notesQuery.isLoading ? (
            <p className="text-sm text-white/80">Loading updates…</p>
          ) : notes.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-rc-teal">No updates on this ticket yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <Card key={n.annotationid} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-rc-navy">{n.subject || 'Update'}</div>
                    <div className="shrink-0 text-xs text-rc-teal" title={formatDate(n.createdon)}>
                      {relativeFromNow(n.createdon)}
                    </div>
                  </div>
                  {cleanDescription(n.notetext) && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-rc-teal">
                      {cleanDescription(n.notetext)}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
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
