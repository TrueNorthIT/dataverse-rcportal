import { useTierList } from '../hooks/useTierList'
import { PROJECT_ORDER, PROJECT_SELECT } from '../services/projectApi'
import type { Project } from '../types/project'
import { formatDate } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { TierToggle } from '../components/common/TierToggle'
import { StatusChip } from '../components/common/StatusChip'
import { ListStates, LoadMore } from '../components/common/ListStates'

/** Projects list with My / Company toggle; subject, status, and schedule dates. */
export function ProjectsPage() {
  const { tier, setTier, items, loading, error, hasMore, loadingMore, loadMore } =
    useTierList<Project>('project', {
      select: PROJECT_SELECT,
      orderBy: PROJECT_ORDER,
      top: 25,
    })

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
        <div className="space-y-3">
          {items.map((p) => (
            <Card key={p.msdyn_projectid} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-rc-navy">
                    {p.msdyn_subject || 'Untitled project'}
                  </div>
                  <div className="mt-1 text-sm text-rc-teal">
                    {formatDate(p.msdyn_scheduledstart)} – {formatDate(p.msdyn_scheduledfinish)}
                  </div>
                </div>
                <StatusChip label={p.statuscode_label} />
              </div>
            </Card>
          ))}
        </div>
        <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
      </ListStates>
    </div>
  )
}
