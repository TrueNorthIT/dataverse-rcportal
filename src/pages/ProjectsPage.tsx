import { useState } from 'react'
import type { FilterCondition } from '@truenorth-it/dataverse-client'
import { useTierList } from '../hooks/useTierList'
import { PROJECT_ORDER, PROJECT_SELECT, projectHealth } from '../services/projectApi'
import type { Project } from '../types/project'
import { cleanDescription, formatDate } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { FilterPills } from '../components/common/FilterPills'
import { ListStates, LoadMore } from '../components/common/ListStates'

const PROJECT_PILLS = [
  { key: 'all', label: 'All' },
  { key: 'ontrack', label: 'On track' },
  { key: 'duesoon', label: 'Due soon' },
  { key: 'overdue', label: 'Overdue' },
]

const isoOffset = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Map a RAG pill to a msdyn_finish date filter — mirrors projectHealth():
 * overdue = finish before today; due soon = finish within 30 days; on track =
 * finish more than 30 days out. (Array conditions are AND-ed by default.)
 */
function projectFilter(key: string): FilterCondition | FilterCondition[] | undefined {
  const today = isoOffset(0)
  const in30 = isoOffset(30)
  if (key === 'overdue') return { field: 'msdyn_finish', operator: 'lt', value: today }
  if (key === 'ontrack') return { field: 'msdyn_finish', operator: 'gt', value: in30 }
  if (key === 'duesoon')
    return [
      { field: 'msdyn_finish', operator: 'ge', value: today },
      { field: 'msdyn_finish', operator: 'le', value: in30 },
    ]
  return undefined
}

/** Projects list with My / Company toggle; subject, status, and schedule dates. */
export function ProjectsPage() {
  // Projects are company-level, so default to the Company tier (me-tier only
  // has rows for the account's primary contact).
  const [rag, setRag] = useState('all')
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Project>(
      'project',
      { select: PROJECT_SELECT, orderBy: PROJECT_ORDER, top: 25, filter: projectFilter(rag) },
      'team',
    )

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={tier === 'me' ? 'Projects you sponsor' : "Your company's projects"}
        actions={<TierToggle tier={tier} onChange={setTier} />}
      />

      <FilterPills options={PROJECT_PILLS} value={rag} onChange={setRag} className="mb-4" />

      <ListStates
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyMessage={rag === 'all' ? 'No projects to show yet.' : 'No projects in that state.'}
      >
        <div className="space-y-3 rc-land-list">
          {items.map((p) => {
            const health = projectHealth(p)
            return (
              <Card key={p.msdyn_projectid} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-rc-navy">
                      {p.msdyn_subject || 'Untitled project'}
                    </div>
                    {cleanDescription(p.msdyn_description) && (
                      <p className="mt-1 line-clamp-2 text-sm text-rc-teal">
                        {cleanDescription(p.msdyn_description)}
                      </p>
                    )}
                    <div className="mt-1 text-sm text-rc-teal">
                      {formatDate(p.msdyn_scheduledstart)} – {formatDate(p.msdyn_finish)}
                    </div>
                    <div className="mt-0.5 text-xs text-rc-teal">{health.detail}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${health.chip}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                      {health.label}
                    </span>
                    <StatusChip label={p.statuscode_label} />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
      </ListStates>
    </div>
  )
}
