import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { fetchProjectDetail, projectHealth, deriveMilestones, deriveDiary } from '../services/projectApi'
import { cleanDescription, formatDate } from '../lib/format'
import { StatusChip } from '../components/common/StatusChip'
import { Icon } from '../components/common/Icon'
import { ProjectTimeline, ProjectDiary } from '../components/project/ProjectViews'
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
  const diary = record ? deriveDiary(record) : []
  const [view, setView] = useState<'timeline' | 'diary'>('timeline')

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

      {record && (milestones.length > 0 || diary.length > 0) && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionTitle icon="activity">Delivery</SectionTitle>
            <ViewToggle view={view} onChange={setView} />
          </div>
          {view === 'timeline' ? (
            <ProjectTimeline project={record} milestones={milestones} />
          ) : (
            <ProjectDiary entries={diary} />
          )}
        </div>
      )}
    </div>
  )
}

/** Segmented Timeline / Diary switch, styled light for the gradient page. */
function ViewToggle({
  view,
  onChange,
}: {
  view: 'timeline' | 'diary'
  onChange: (v: 'timeline' | 'diary') => void
}) {
  const opts: { key: 'timeline' | 'diary'; label: string; icon: 'activity' | 'fileText' }[] = [
    { key: 'timeline', label: 'Timeline', icon: 'activity' },
    { key: 'diary', label: 'Diary', icon: 'fileText' },
  ]
  return (
    <div className="inline-flex rounded-lg border border-white/30 p-0.5">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ' +
            (view === o.key ? 'bg-white text-rc-navy' : 'text-white/90 hover:bg-white/10')
          }
        >
          <Icon name={o.icon} className="h-3.5 w-3.5" />
          {o.label}
        </button>
      ))}
    </div>
  )
}
