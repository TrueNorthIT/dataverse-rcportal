import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDataverseClient } from '../lib/client'
import { useList, type SortOption } from '../hooks/useList'
import { CASE_SELECT, CASE_PILLS, createCase } from '../services/caseApi'
import type { Case } from '../types/case'
import { cleanDescription, formatDate, relativeFromNow } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { CardButton } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { FilterPills } from '../components/common/FilterPills'
import { SortMenu } from '../components/common/SortMenu'
import { ListStates, LoadMore } from '../components/common/ListStates'
import { RaiseCase } from '../components/RaiseCase'

const CASE_SORTS: SortOption[] = [
  { key: 'newest', label: 'Newest', order: { field: 'createdon', direction: 'desc' } },
  { key: 'oldest', label: 'Oldest', order: { field: 'createdon', direction: 'asc' } },
  { key: 'priority', label: 'Priority (high first)', order: { field: 'prioritycode', direction: 'asc' } },
]

/**
 * Support cases — the primary self-service action a customer takes (spec: the
 * customer manages their identity and raises tickets; everything else is
 * read-only). The list machinery is shared via useList; this page adds the
 * raise-a-ticket create form on top.
 */
export function CasesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const client = useDataverseClient()
  const list = useList<Case>({
    table: 'case',
    select: CASE_SELECT,
    pills: [...CASE_PILLS],
    sorts: CASE_SORTS,
    defaultSort: 'newest',
    defaultTier: 'team',
  })
  const { tier, items } = list
  const [raising, setRaising] = useState(false)
  const ids = items.map((i) => i.incidentid)

  return (
    <div>
      <PageHeader
        title="Support"
        subtitle={tier === 'me' ? 'Tickets you raised' : "Your company's tickets"}
        actions={
          <>
            <TierToggle tier={tier} onChange={list.setTier} />
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
          value={list.filter}
          onChange={list.setFilter}
          disabledKeys={list.disabledKeys}
        />
        <SortMenu options={CASE_SORTS} value={list.activeSort.key} onChange={list.setSort} />
      </div>

      {raising && (
        <RaiseCase
          onCancel={() => setRaising(false)}
          onCreated={async () => {
            setRaising(false)
            list.setTier('me')
            await list.refresh()
          }}
          create={(input) => createCase(client, input)}
        />
      )}

      <ListStates
        loading={list.loading}
        error={list.error}
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
              onClick={() =>
                navigate(`/cases/${c.incidentid}`, {
                  state: {
                    ids,
                    from: location.pathname + location.search,
                    tier,
                  },
                })
              }
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
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </ListStates>
    </div>
  )
}
