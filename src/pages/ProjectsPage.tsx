import { useTierList } from '../hooks/useTierList'
import { PROJECT_ORDER, PROJECT_SELECT, projectHealth } from '../services/projectApi'
import type { Project } from '../types/project'
import { cleanDescription, formatDate } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { ListStates, LoadMore } from '../components/common/ListStates'

/** Projects list with My / Company toggle; subject, status, and schedule dates. */
export function ProjectsPage() {
  // Projects are company-level, so default to the Company tier (me-tier only
  // has rows for the account's primary contact).
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Project>(
      'project',
      { select: PROJECT_SELECT, orderBy: PROJECT_ORDER, top: 25 },
      'team',
    )

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={tier === 'me' ? 'Projects you sponsor' : "Your company's projects"}
        actions={<TierToggle tier={tier} onChange={setTier} />}
      />

      <ListStates
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyMessage="No projects to show yet."
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
