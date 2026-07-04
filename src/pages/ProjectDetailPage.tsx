import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { fetchProjectDetail, projectHealth, deriveMilestones } from '../services/projectApi'
import { cleanDescription, formatDate } from '../lib/format'
import { Card } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'
import { Icon } from '../components/common/Icon'
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
  const { selectedContactId } = useSelectedCompany()
  const { tier, prevId, nextId, goPrev, goNext, goBack } = useListNav('/projects', id)

  const query = useQuery({
    queryKey: ['project', id, tier ?? 'auto', selectedContactId ?? 'default'],
    queryFn: () => fetchProjectDetail(client, id!, tier),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const error = query.error instanceof Error ? query.error.message : null
  const health = record ? projectHealth(record) : null
  const milestones = record ? deriveMilestones(record) : []

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
              {health && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${health.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                  {health.label}
                </span>
              )}
              <StatusChip label={record.statuscode_label} />
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

      {record && milestones.length > 0 && (
        <div className="mt-6">
          <SectionTitle icon="activity">Milestones</SectionTitle>
          <Card className="p-5">
            <ol className="relative ml-1 space-y-4 border-l border-rc-blue-light pl-5">
              {milestones.map((m) => (
                <li key={m.key} className="relative">
                  <span
                    className={`absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                      m.done ? 'bg-rc-green text-white' : 'border-2 border-rc-blue-light bg-white'
                    }`}
                  >
                    {m.done && <Icon name="checkCircle" className="h-3 w-3" />}
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm ${m.done ? 'font-medium text-rc-navy' : 'text-rc-teal'}`}>
                      {m.label}
                    </span>
                    <span className="shrink-0 text-xs text-rc-teal">{formatDate(m.date)}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[11px] text-rc-teal/70">Illustrative delivery milestones derived from the schedule.</p>
          </Card>
        </div>
      )}
    </div>
  )
}
