/**
 * Customer-facing project plan views. On the detail page a compact ProjectPlanCard
 * summarises progress + next milestone and opens ProjectPlanModal — a full-screen
 * plan the customer can actually read: a proper Gantt (phase bars across a month
 * axis with a Today line + milestone markers) and a dated Diary. All demo dressing
 * derived from the schedule (projectApi's derivePhases / deriveMilestones / deriveDiary).
 */
import { useEffect, useState } from 'react'
import type { Project } from '../../types/project'
import type { DiaryEntry, DiaryKind, Milestone, Phase } from '../../services/projectApi'
import { formatDate } from '../../lib/format'
import { Card } from '../common/Card'
import { Icon } from '../common/Icon'
import type { IconName } from '../common/Icon'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function bounds(project: Project) {
  const startStr = project.msdyn_actualstart || project.msdyn_scheduledstart
  const s = startStr ? Date.parse(startStr) : NaN
  const e = project.msdyn_finish ? Date.parse(project.msdyn_finish) : NaN
  return { startStr, s, e, valid: !Number.isNaN(s) && !Number.isNaN(e) && e > s }
}

// ── On-page summary card ─────────────────────────────────────────────────────

export function ProjectPlanCard({
  project,
  milestones,
  onOpen,
}: {
  project: Project
  milestones: Milestone[]
  onOpen: () => void
}) {
  const { startStr, s, e, valid } = bounds(project)
  const now = Date.now()
  const pct = valid ? Math.round(clamp01((now - s) / (e - s)) * 100) : 0
  const next = milestones.find((m) => !m.done)

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-rc-teal">
          {valid ? `${formatDate(startStr)} → ${formatDate(project.msdyn_finish)}` : 'Schedule not set'}
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rc-blue px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rc-navy"
        >
          <Icon name="maximize" className="h-4 w-4" />
          View full plan
        </button>
      </div>

      {valid && (
        <>
          <div className="relative mt-4 h-2.5 rounded-full bg-rc-blue-light">
            <div className="absolute inset-y-0 left-0 rounded-full rc-gradient" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-rc-teal">
            <span>{pct}% elapsed</span>
            <span>
              {next ? (
                <>Next: <span className="text-rc-navy">{next.label}</span> · {formatDate(next.date)}</>
              ) : (
                'All milestones complete'
              )}
            </span>
          </div>
        </>
      )}
    </Card>
  )
}

// ── Full-screen plan modal ───────────────────────────────────────────────────

export function ProjectPlanModal({
  project,
  phases,
  milestones,
  diary,
  onClose,
}: {
  project: Project
  phases: Phase[]
  milestones: Milestone[]
  diary: DiaryEntry[]
  onClose: () => void
}) {
  const [tab, setTab] = useState<'gantt' | 'diary'>('gantt')
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-rc-navy/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Project plan"
        className="rc-fade-up relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-xl"
      >
        <div className="rc-gradient h-1 w-full" />
        <header className="flex items-start justify-between gap-4 border-b border-rc-blue-light px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-normal tracking-tight text-rc-navy">
              {project.msdyn_subject || 'Project'}
            </h2>
            <p className="text-xs text-rc-teal">Delivery plan</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-rc-blue-light p-0.5">
              {([['gantt', 'Gantt', 'gantt'], ['diary', 'Diary', 'fileText']] as const).map(([k, label, icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ' +
                    (tab === k ? 'bg-rc-blue text-white' : 'text-rc-teal hover:bg-rc-blue-light/40')
                  }
                >
                  <Icon name={icon as IconName} className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-rc-teal transition-colors hover:bg-rc-blue-light/40 hover:text-rc-navy"
            >
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-5">
          {tab === 'gantt' ? (
            <ProjectGantt project={project} phases={phases} milestones={milestones} />
          ) : (
            <ProjectDiary entries={diary} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Gantt ────────────────────────────────────────────────────────────────────

const LABEL_COL = 'w-40 shrink-0 pr-3'

/** Month tick labels positioned by fraction along [s, e]. */
function monthTicks(s: number, e: number): { frac: number; label: string }[] {
  const out: { frac: number; label: string }[] = []
  const d = new Date(s)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  if (d.getTime() < s) d.setMonth(d.getMonth() + 1)
  let guard = 0
  while (d.getTime() <= e && guard++ < 60) {
    const label =
      d.getMonth() === 0
        ? `${d.toLocaleDateString('en-GB', { month: 'short' })} ${String(d.getFullYear()).slice(2)}`
        : d.toLocaleDateString('en-GB', { month: 'short' })
    out.push({ frac: (d.getTime() - s) / (e - s), label })
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

function ProjectGantt({ project, phases, milestones }: { project: Project; phases: Phase[]; milestones: Milestone[] }) {
  const { s, e, valid } = bounds(project)
  if (!valid || phases.length === 0) {
    return <p className="text-sm text-rc-teal">This project has no schedule to plot yet.</p>
  }
  const now = Date.now()
  const frac = (t: number) => clamp01((t - s) / (e - s)) * 100
  const todayIn = now >= s && now <= e
  const ticks = monthTicks(s, e)

  const barTone = (status: Phase['status']) =>
    status === 'done'
      ? 'rc-gradient'
      : status === 'upcoming'
        ? 'bg-rc-blue-light/60 border border-rc-blue-light'
        : 'bg-rc-blue-light'

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* month axis */}
        <div className="flex">
          <div className={LABEL_COL} />
          <div className="relative h-6 flex-1">
            {ticks.map((t) => (
              <span key={t.label + t.frac} className="absolute top-1 -translate-x-1/2 text-[11px] text-rc-teal" style={{ left: `${t.frac * 100}%` }}>
                {t.label}
              </span>
            ))}
            {/* milestone markers on the axis */}
            {milestones.map((m) => (
              <span
                key={m.key}
                title={`${m.label} · ${formatDate(m.date)}`}
                className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-2 ring-white ${m.done ? 'bg-rc-green' : 'bg-rc-blue'}`}
                style={{ left: `${frac(Date.parse(m.date))}%` }}
              />
            ))}
          </div>
        </div>

        {/* rows with gridlines + today overlay */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-40 right-0">
            {ticks.map((t) => (
              <div key={t.label + t.frac} className="absolute inset-y-0 w-px bg-rc-blue-light/50" style={{ left: `${t.frac * 100}%` }} />
            ))}
            {todayIn && (
              <div className="absolute inset-y-0 w-0.5 bg-rc-navy/70" style={{ left: `${frac(now)}%` }}>
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rc-navy px-1.5 py-0.5 text-[9px] font-medium text-white">
                  Today
                </span>
              </div>
            )}
          </div>

          {phases.map((ph) => {
            const left = frac(Date.parse(ph.start))
            const width = Math.max(1, frac(Date.parse(ph.end)) - left)
            return (
              <div key={ph.key} className="flex items-center py-1.5">
                <div className={`${LABEL_COL} truncate text-sm text-rc-navy`} title={ph.label}>
                  {ph.label}
                </div>
                <div className="relative h-7 flex-1">
                  <div
                    className={`absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md ${barTone(ph.status)}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${ph.label} · ${formatDate(ph.start)} – ${formatDate(ph.end)}`}
                  >
                    {ph.status === 'active' && (
                      <div className="h-full rounded-md rc-gradient" style={{ width: `${ph.pct * 100}%` }} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-rc-teal">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded rc-gradient" /> Complete / in progress</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-rc-blue-light/60 border border-rc-blue-light" /> Upcoming</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-rc-blue" /> Milestone</span>
        </div>
        <p className="mt-3 text-[11px] text-rc-teal/70">Illustrative delivery plan derived from the project schedule.</p>
      </div>
    </div>
  )
}

// ── Diary ────────────────────────────────────────────────────────────────────

const KIND_STYLE: Record<DiaryKind, { icon: IconName; bubble: string }> = {
  milestone: { icon: 'checkCircle', bubble: 'bg-rc-green-light text-rc-green-dark' },
  update: { icon: 'activity', bubble: 'bg-rc-blue-light text-rc-blue' },
  risk: { icon: 'flag', bubble: 'bg-amber-100 text-amber-700' },
  note: { icon: 'fileText', bubble: 'bg-rc-blue-light text-rc-teal' },
}

/** Dated project diary — newest first. Shows the actual date (it's a diary). */
export function ProjectDiary({ entries }: { entries: DiaryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-rc-teal">No diary entries yet — this project hasn't started.</p>
  }
  return (
    <div>
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
                <span className="shrink-0 text-xs font-medium text-rc-teal">{formatDate(d.date)}</span>
              </div>
              <p className="mt-0.5 text-sm text-rc-teal">{d.detail}</p>
              {d.author && <p className="mt-1 text-xs text-rc-teal/70">{d.author}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
