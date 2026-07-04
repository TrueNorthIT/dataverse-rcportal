import { useEffect } from 'react'
import type { FilterCondition, OrderBy } from '@truenorth-it/dataverse-client'
import { useTierList } from '../hooks/useTierList'
import { usePillCounts } from '../hooks/usePillCounts'
import { useListControls } from '../hooks/useListControls'
import { PROJECT_SELECT, projectHealth } from '../services/projectApi'
import type { Project } from '../types/project'
import { cleanDescription, formatDate } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { FilterPills } from '../components/common/FilterPills'
import { SortMenu } from '../components/common/SortMenu'
import { ListStates, LoadMore } from '../components/common/ListStates'

interface ProjectPill {
  key: string
  label: string
  filter?: FilterCondition | FilterCondition[]
}

// Default: by due date (soonest finish first) so overdue/at-risk float up.
const PROJECT_SORTS: { key: string; label: string; order: OrderBy }[] = [
  { key: 'due', label: 'Due date', order: { field: 'msdyn_finish', direction: 'asc' } },
  { key: 'start', label: 'Start date', order: { field: 'msdyn_scheduledstart', direction: 'asc' } },
  { key: 'added', label: 'Recently added', order: { field: 'createdon', direction: 'desc' } },
]

const isoOffset = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * RAG pills with msdyn_finish date filters — mirrors projectHealth(): overdue =
 * finish before today; due soon = finish within 30 days; on track = finish more
 * than 30 days out. (Array conditions are AND-ed by default.)
 */
function buildProjectPills(): ProjectPill[] {
  const today = isoOffset(0)
  const in30 = isoOffset(30)
  return [
    { key: 'all', label: 'All' },
    { key: 'ontrack', label: 'On track', filter: { field: 'msdyn_finish', operator: 'gt', value: in30 } },
    {
      key: 'duesoon',
      label: 'Due soon',
      filter: [
        { field: 'msdyn_finish', operator: 'ge', value: today },
        { field: 'msdyn_finish', operator: 'le', value: in30 },
      ],
    },
    { key: 'overdue', label: 'Overdue', filter: { field: 'msdyn_finish', operator: 'lt', value: today } },
  ]
}

/** Projects list with My / Company toggle; subject, status, and schedule dates. */
export function ProjectsPage() {
  // Projects are company-level, so default to the Company tier (me-tier only
  // has rows for the account's primary contact).
  const { filter: rag, setFilter: setRag, sort, setSort } = useListControls('all', 'due')
  const pills = buildProjectPills()
  const activeSort = PROJECT_SORTS.find((s) => s.key === sort) ?? PROJECT_SORTS[0]
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Project>(
      'project',
      {
        select: PROJECT_SELECT,
        orderBy: activeSort.order,
        top: 25,
        filter: pills.find((p) => p.key === rag)?.filter,
      },
      'team',
    )

  const counts = usePillCounts('project', tier, pills)
  const disabledKeys = new Set(pills.filter((p) => counts[p.key] === 0).map((p) => p.key))
  useEffect(() => {
    if (rag !== 'all' && counts[rag] === 0) setRag('all')
  }, [counts, rag, setRag])

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={tier === 'me' ? 'Projects you sponsor' : "Your company's projects"}
        actions={<TierToggle tier={tier} onChange={setTier} />}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FilterPills
          options={pills.map((p) => ({ key: p.key, label: p.label }))}
          value={rag}
          onChange={setRag}
          disabledKeys={disabledKeys}
        />
        <SortMenu options={PROJECT_SORTS} value={activeSort.key} onChange={setSort} />
      </div>

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
