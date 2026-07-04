import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTierList } from '../hooks/useTierList'
import { useListControls } from '../hooks/useListControls'
import { useDataverseClient } from '../lib/client'
import { CASE_SELECT, createCase } from '../services/caseApi'
import type { Case } from '../types/case'
import { cleanDescription, formatDate, relativeFromNow } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { CardButton } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { FilterPills } from '../components/common/FilterPills'
import { SortMenu } from '../components/common/SortMenu'
import { usePillCounts } from '../hooks/usePillCounts'
import { ListStates, LoadMore } from '../components/common/ListStates'
import type { FilterCondition, OrderBy } from '@truenorth-it/dataverse-client'

interface Pill {
  key: string
  label: string
  filter?: FilterCondition | FilterCondition[]
}

// prioritycode: 1 = High, 2 = Normal, 3 = Low.
const CASE_PILLS: Pill[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High', filter: { field: 'prioritycode', operator: 'eq', value: 1 } },
  { key: 'normal', label: 'Normal', filter: { field: 'prioritycode', operator: 'eq', value: 2 } },
  { key: 'low', label: 'Low', filter: { field: 'prioritycode', operator: 'eq', value: 3 } },
]

const CASE_SORTS: { key: string; label: string; order: OrderBy }[] = [
  { key: 'newest', label: 'Newest', order: { field: 'createdon', direction: 'desc' } },
  { key: 'oldest', label: 'Oldest', order: { field: 'createdon', direction: 'asc' } },
  { key: 'priority', label: 'Priority (high first)', order: { field: 'prioritycode', direction: 'asc' } },
]

/**
 * Support cases — the primary self-service action a customer takes (spec: the
 * customer manages their identity and raises tickets; everything else is
 * read-only). List with My / Company toggle + raise-a-ticket create.
 */
export function CasesPage() {
  const navigate = useNavigate()
  const client = useDataverseClient()
  const { filter: priority, setFilter: setPriority, sort, setSort } = useListControls('all', 'newest')
  const activeSort = CASE_SORTS.find((s) => s.key === sort) ?? CASE_SORTS[0]
  const {
    tier,
    setTier,
    items,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    refresh,
  } = useTierList<Case>(
    'case',
    {
      select: CASE_SELECT,
      orderBy: activeSort.order,
      top: 25,
      filter: CASE_PILLS.find((p) => p.key === priority)?.filter,
    },
    'team',
  )

  const counts = usePillCounts('case', tier, [...CASE_PILLS])
  const disabledKeys = new Set(CASE_PILLS.filter((p) => counts[p.key] === 0).map((p) => p.key))
  useEffect(() => {
    if (priority !== 'all' && counts[priority] === 0) setPriority('all')
  }, [counts, priority, setPriority])

  const [raising, setRaising] = useState(false)

  return (
    <div>
      <PageHeader
        title="Support"
        subtitle={tier === 'me' ? 'Tickets you raised' : "Your company's tickets"}
        actions={
          <>
            <TierToggle tier={tier} onChange={setTier} />
            <button
              type="button"
              onClick={() => setRaising((v) => !v)}
              className="rounded-lg bg-rc-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-rc-navy transition-colors"
            >
              Raise a ticket
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FilterPills
          options={CASE_PILLS.map((p) => ({ key: p.key, label: p.label }))}
          value={priority}
          onChange={setPriority}
          disabledKeys={disabledKeys}
        />
        <SortMenu options={CASE_SORTS} value={activeSort.key} onChange={setSort} />
      </div>

      {raising && (
        <RaiseCase
          onCancel={() => setRaising(false)}
          onCreated={async () => {
            setRaising(false)
            setTier('me')
            await refresh()
          }}
          create={(input) => createCase(client, input)}
        />
      )}

      <ListStates
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyMessage={
          tier === 'me'
            ? "You haven't raised any tickets yet."
            : 'No tickets for your company yet.'
        }
      >
        <div className="space-y-3 rc-land-list">
          {items.map((c) => (
            <CardButton
              key={c.incidentid}
              onClick={() => navigate(`/cases/${c.incidentid}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-rc-navy">{c.title || 'Untitled'}</div>
                  {cleanDescription(c.description) && (
                    <p className="mt-1 line-clamp-2 text-sm text-rc-teal">
                      {cleanDescription(c.description)}
                    </p>
                  )}
                  <div className="mt-1 text-sm text-rc-teal">
                    {c.ticketnumber ? `${c.ticketnumber} · ` : ''}
                    Raised {formatDate(c.createdon)}
                  </div>
                  <div className="mt-0.5 text-xs text-rc-teal">
                    {relativeFromNow(c.createdon)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusChip label={c.statuscode_label} />
                  {c.prioritycode_label && (
                    <span className="text-xs text-rc-teal">{c.prioritycode_label}</span>
                  )}
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

/** Inline "raise a ticket" form. Auto-binding sets the contact + account. */
function RaiseCase({
  create,
  onCreated,
  onCancel,
}: {
  create: (input: { title: string; description?: string }) => Promise<unknown>
  onCreated: () => void | Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await create({ title: title.trim(), description: description.trim() || undefined })
      await onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to raise ticket')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-5 overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-sm"
    >
      <div className="rc-gradient h-1 w-full" />
      <div className="space-y-4 p-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-rc-teal">Summary</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Brief summary of the issue"
            className="rc-input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-rc-teal">Details</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What's happening, and any impact?"
            className="rc-input resize-y"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white hover:bg-rc-navy disabled:opacity-50 transition-colors"
          >
            {saving ? 'Submitting…' : 'Submit ticket'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-rc-blue-light px-4 py-2 text-sm font-medium text-rc-navy hover:bg-rc-blue-light transition-colors"
          >
            Cancel
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </form>
  )
}
