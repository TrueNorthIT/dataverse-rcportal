/**
 * Two funky read-only views for a project: a horizontal Gantt-style Timeline
 * (schedule band with progress fill, a Today marker, and milestone pins, plus
 * the milestone list) and a Diary activity feed. Both are demo dressing derived
 * from the project's schedule — see projectApi's deriveMilestones/deriveDiary.
 */
import type { Project } from '../../types/project'
import type { DiaryEntry, DiaryKind, Milestone } from '../../services/projectApi'
import { formatDate, relativeFromNow } from '../../lib/format'
import { Card } from '../common/Card'
import { Icon } from '../common/Icon'
import type { IconName } from '../common/Icon'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Horizontal schedule band + milestone list. */
export function ProjectTimeline({ project, milestones }: { project: Project; milestones: Milestone[] }) {
  const startStr = project.msdyn_actualstart || project.msdyn_scheduledstart
  const s = startStr ? Date.parse(startStr) : NaN
  const e = project.msdyn_finish ? Date.parse(project.msdyn_finish) : NaN
  const valid = !Number.isNaN(s) && !Number.isNaN(e) && e > s
  const now = Date.now()
  const progress = valid ? clamp01((now - s) / (e - s)) : 0
  const pct = Math.round(progress * 100)

  return (
    <Card className="p-5">
      {valid && (
        <>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-rc-teal">
            <span>{formatDate(startStr)}</span>
            <span className="text-rc-navy">{pct}% elapsed</span>
            <span>{formatDate(project.msdyn_finish)}</span>
          </div>
          {/* schedule band: fill to today, milestone pins, today marker */}
          <div className="relative mt-4 mb-6 h-2.5 rounded-full bg-rc-blue-light">
            <div className="absolute inset-y-0 left-0 rounded-full rc-gradient" style={{ width: `${pct}%` }} />
            {progress > 0 && progress < 1 && (
              <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-rc-navy" style={{ left: `${pct}%` }}>
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rc-navy px-2 py-0.5 text-[10px] font-medium text-white">
                  Today
                </span>
              </div>
            )}
            {milestones.map((m) => {
              const left = clamp01((Date.parse(m.date) - s) / (e - s)) * 100
              return (
                <span
                  key={m.key}
                  title={`${m.label} · ${formatDate(m.date)}`}
                  className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${
                    m.done ? 'bg-rc-green' : 'border-2 border-rc-blue bg-white'
                  }`}
                  style={{ left: `${left}%` }}
                />
              )
            })}
          </div>
        </>
      )}

      {/* milestone list */}
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
              <span className={`text-sm ${m.done ? 'font-medium text-rc-navy' : 'text-rc-teal'}`}>{m.label}</span>
              <span className="shrink-0 text-xs text-rc-teal" title={formatDate(m.date)}>{relativeFromNow(m.date)}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] text-rc-teal/70">Illustrative delivery timeline derived from the schedule.</p>
    </Card>
  )
}

const KIND_STYLE: Record<DiaryKind, { icon: IconName; bubble: string }> = {
  milestone: { icon: 'checkCircle', bubble: 'bg-rc-green-light text-rc-green-dark' },
  update: { icon: 'activity', bubble: 'bg-rc-blue-light text-rc-blue' },
  risk: { icon: 'flag', bubble: 'bg-amber-100 text-amber-700' },
  note: { icon: 'fileText', bubble: 'bg-rc-blue-light text-rc-teal' },
}

/** Chronological project diary — newest first, like the case timeline. */
export function ProjectDiary({ entries }: { entries: DiaryEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-rc-teal">No diary entries yet — this project hasn't started.</p>
      </Card>
    )
  }
  return (
    <Card className="p-5">
      <ol className="relative ml-4 space-y-5 border-l border-rc-blue-light pl-6">
        {entries.map((d) => {
          const style = KIND_STYLE[d.kind]
          return (
            <li key={d.key} className="relative">
              <span className={`absolute -left-[38px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${style.bubble}`}>
                <Icon name={style.icon} className="h-3.5 w-3.5" />
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-rc-navy">{d.title}</span>
                <span className="shrink-0 text-xs text-rc-teal" title={formatDate(d.date)}>
                  {relativeFromNow(d.date)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-rc-teal">{d.detail}</p>
              <p className="mt-1 text-xs text-rc-teal/70">{d.author}</p>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-[11px] text-rc-teal/70">Illustrative delivery diary derived from the schedule.</p>
    </Card>
  )
}
