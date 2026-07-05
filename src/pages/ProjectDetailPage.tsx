import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { fetchProjectDetail, projectHealth, listProjectTasks, listProjectNotes } from '../services/projectApi'
import { cleanDescription, formatDate } from '../lib/format'
import { Icon } from '../components/common/Icon'
import { ProjectPlanCard, ProjectPlanModal } from '../components/project/ProjectViews'
import {
  DetailHeader,
  DetailNav,
  DetailSkeleton,
  MetaGrid,
  MetaItem,
  SectionTitle,
} from '../components/detail/DetailChrome'

/** Read-only project detail: schedule, RAG health, description, milestone timeline. */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const client = useDataverseClient()
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedContactId } = useSelectedCompany()
  const { tier, prevId, nextId, goPrev, goNext, goBack } = useListNav('/projects', id)

  // The plan modal's open state lives in the URL hash (#plan) so it's
  // shareable/deep-linkable and survives a refresh.
  const planOpen = location.hash.startsWith('#plan')
  const openPlan = () => navigate(`${location.pathname}${location.search}#plan`)
  const closePlan = () => navigate(`${location.pathname}${location.search}`, { replace: true })

  const query = useQuery({
    queryKey: ['project', id, tier ?? 'auto', selectedContactId ?? 'default'],
    queryFn: () => fetchProjectDetail(client, id!, tier),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const mine = query.data?.mine ?? false
  const error = query.error instanceof Error ? query.error.message : null
  const health = record ? projectHealth(record) : null

  // Real plan items (new_projecttask rows) → Gantt phases + milestones.
  const tasksQuery = useQuery({
    queryKey: ['projecttasks', id, mine, selectedContactId ?? 'default'],
    queryFn: () => listProjectTasks(client, id!, mine),
    enabled: !!id && !!record,
  })
  const phases = tasksQuery.data?.phases ?? []
  const milestones = tasksQuery.data?.milestones ?? []

  // Real delivery notes (annotations regarding the project).
  const notesQuery = useQuery({
    queryKey: ['projectnotes', id, mine, selectedContactId ?? 'default'],
    queryFn: () => listProjectNotes(client, id!, mine),
    enabled: !!id && !!record,
  })
  const diary = notesQuery.data ?? []

  return (
    <div>
      <DetailNav label="Projects" prevId={prevId} nextId={nextId} onPrev={goPrev} onNext={goNext} onBack={goBack} />

      {query.isLoading && <DetailSkeleton />}
      {error && <p className="text-sm text-red-200">{error}</p>}

      {record && (
        <DetailHeader
          icon="layers"
          title={record.msdyn_subject || 'Project'}
          trailing={
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {/* Only the derived RAG chip — the same signal as the Projects
                  list pills. statuscode is a constant "Active" for every demo
                  project and would clash with a "Complete" chip, so we let the
                  "Actual finish" meta field below tell the delivery story. */}
              {health && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${health.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                  {health.label}
                </span>
              )}
            </div>
          }
        >
          {health && <p className="mt-3 text-sm text-rc-teal">{health.detail}</p>}
          <MetaGrid>
            <MetaItem icon="calendar" label="Scheduled start" value={formatDate(record.msdyn_scheduledstart)} />
            <MetaItem icon="calendar" label="Scheduled finish" value={formatDate(record.msdyn_finish)} />
            <MetaItem icon="flag" label="Actual start" value={formatDate(record.msdyn_actualstart)} />
            <MetaItem icon="checkCircle" label="Actual finish" value={formatDate(record.msdyn_actualend)} />
            <MetaItem icon="clock" label="Created" value={formatDate(record.createdon)} />
          </MetaGrid>

          {cleanDescription(record.msdyn_description) && (
            <div className="mt-6">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-rc-teal">
                <Icon name="fileText" className="h-3.5 w-3.5" /> Description
              </dt>
              <p className="mt-1 whitespace-pre-wrap text-sm text-rc-navy">
                {cleanDescription(record.msdyn_description)}
              </p>
            </div>
          )}
        </DetailHeader>
      )}

      {record && (phases.length > 0 || milestones.length > 0) && (
        <div className="mt-6">
          <SectionTitle icon="gantt">Delivery plan</SectionTitle>
          <ProjectPlanCard project={record} milestones={milestones} onOpen={openPlan} />
        </div>
      )}

      {record && planOpen && (
        <ProjectPlanModal
          project={record}
          phases={phases}
          milestones={milestones}
          diary={diary}
          onClose={closePlan}
        />
      )}
    </div>
  )
}
