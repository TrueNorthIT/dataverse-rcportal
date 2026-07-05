import { ListScreen } from '../components/common/ListScreen'
import type { SortOption } from '../hooks/useList'
import { PROJECT_SELECT, projectHealth, buildProjectPills } from '../services/projectApi'
import type { Project } from '../types/project'
import { cleanDescription, formatDate } from '../lib/format'

// Default: by due date (soonest finish first) so overdue/at-risk float up.
const PROJECT_SORTS: SortOption[] = [
  { key: 'due', label: 'Due date', order: { field: 'msdyn_finish', direction: 'asc' } },
  { key: 'start', label: 'Start date', order: { field: 'msdyn_scheduledstart', direction: 'asc' } },
  { key: 'added', label: 'Recently added', order: { field: 'createdon', direction: 'desc' } },
]

/** One project row: subject, description, schedule, and a single RAG chip. */
function ProjectRow({ project: p }: { project: Project }) {
  const health = projectHealth(p)
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium text-rc-navy">{p.msdyn_subject || 'Untitled project'}</div>
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
        {/* Single RAG chip, derived from the same signal as the filter pills
            (finish date + msdyn_actualend), so the chip and the active pill
            always agree. We deliberately don't also show statuscode here —
            every demo project is "Active", so it carries no information and
            would clash with a "Complete" RAG chip on delivered projects. */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${health.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
          {health.label}
        </span>
      </div>
    </div>
  )
}

/**
 * Projects list. Company-level records, so it opens on the Company tier
 * (me-tier only has rows for the account's primary contact).
 */
export function ProjectsPage() {
  return (
    <ListScreen<Project>
      title="Projects"
      subtitle={{ me: 'Projects you sponsor', team: "Your company's projects" }}
      basePath="/projects"
      table="project"
      select={PROJECT_SELECT}
      pills={buildProjectPills()}
      sorts={PROJECT_SORTS}
      defaultSort="due"
      defaultTier="team"
      getId={(p) => p.msdyn_projectid ?? ''}
      emptyMessage={(f) => (f === 'all' ? 'No projects to show yet.' : 'No projects in that state.')}
      renderRow={(p) => <ProjectRow project={p} />}
    />
  )
}
