import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDataverseClient } from '../lib/client'
import { getCase } from '../services/caseApi'
import type { Case } from '../types/case'
import { formatDate } from '../lib/format'
import { Card } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'

/** Support case detail: summary, status/priority, description, dates. */
export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const client = useDataverseClient()

  const [record, setRecord] = useState<Case | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const c = await getCase(client, id)
        if (!cancelled) setRecord(c)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load case')
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
        onClick={() => navigate('/cases')}
        className="mb-4 text-sm font-medium text-rc-blue hover:underline"
      >
        ← Support
      </button>

      {loading && <p className="text-sm text-rc-teal">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

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
