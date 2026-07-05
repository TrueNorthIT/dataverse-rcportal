import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Project } from '../types/project'
import type { Projectnotes, Projecttask } from '../types/dataverse.generated'
import { humanDuration, cleanDescription } from '../lib/format'

/** Columns the portal reads for projects (Dataverse `msdyn_project`). */
export const PROJECT_SELECT = [
  'msdyn_projectid',
  'msdyn_subject',
  'msdyn_scheduledstart',
  'msdyn_finish',
  'msdyn_description',
  'statecode',
  'statuscode',
  'createdon',
]

/** Richer column set for the project detail view (adds actual dates). */
export const PROJECT_DETAIL_SELECT = [
  ...PROJECT_SELECT,
  'msdyn_actualstart',
  'msdyn_actualend',
  'modifiedon',
]

/** Default list ordering — soonest to start first. */
export const PROJECT_ORDER = { field: 'msdyn_scheduledstart', direction: 'asc' } as const

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Fetch a single project for the detail view. Projects are company-level, so
 * `team` is the reliable tier; with a hint we honour it, else team then me.
 */
export async function fetchProjectDetail(
  client: DataverseClient,
  id: string,
  preferTier?: 'me' | 'team',
): Promise<{ record: Project; mine: boolean }> {
  if (preferTier) {
    const res = await client[preferTier].get<Project>('project', id, { select: PROJECT_DETAIL_SELECT })
    return { record: res.data, mine: preferTier === 'me' }
  }
  try {
    const res = await client.team.get<Project>('project', id, { select: PROJECT_DETAIL_SELECT })
    return { record: res.data, mine: false }
  } catch {
    const res = await client.me.get<Project>('project', id, { select: PROJECT_DETAIL_SELECT })
    return { record: res.data, mine: true }
  }
}

// ── Plan items (real new_projecttask rows) ───────────────────────────────────

/** A milestone on the plan (a `new_projecttask` with new_ismilestone = true). */
export interface Milestone {
  key: string
  label: string
  /** ISO date of the milestone. */
  date: string
  done: boolean
}

/** A phase bar on the Gantt (a `new_projecttask` with new_ismilestone = false). */
export interface Phase {
  key: string
  label: string
  start: string
  end: string
  status: 'done' | 'active' | 'upcoming'
  /** 0–1 completion (from new_percentcomplete). */
  pct: number
}

export const PROJECT_TASK_SELECT = [
  'new_projecttaskid',
  'new_name',
  'new_startdate',
  'new_enddate',
  'new_ismilestone',
  'new_percentcomplete',
  'new_sequence',
]

/**
 * List a project's real plan items (`new_projecttask`), scoped to the tier the
 * project resolved at, split into Gantt phase bars + milestones. All real DV
 * rows — visible in Dataverse.
 */
export async function listProjectTasks(
  client: DataverseClient,
  projectId: string,
  mine: boolean,
): Promise<{ phases: Phase[]; milestones: Milestone[] }> {
  const res = await client[mine ? 'me' : 'team'].list<Projecttask>('projecttask', {
    select: PROJECT_TASK_SELECT,
    filter: { field: 'new_projectid', operator: 'eq', value: projectId },
    orderBy: { field: 'new_sequence', direction: 'asc' },
    top: 100,
  })
  const now = Date.now()
  const phases: Phase[] = []
  const milestones: Milestone[] = []
  res.data.forEach((t, i) => {
    const pct = t.new_percentcomplete ?? 0
    if (t.new_ismilestone) {
      const date = t.new_startdate ?? ''
      const ts = date ? Date.parse(date) : NaN
      milestones.push({
        key: t.new_projecttaskid ?? `m-${i}`,
        label: t.new_name || 'Milestone',
        date,
        done: pct >= 100 || (!Number.isNaN(ts) && ts <= now),
      })
    } else {
      const start = t.new_startdate ?? ''
      const end = t.new_enddate ?? start
      const s = Date.parse(start)
      const e = Date.parse(end)
      const status = !Number.isNaN(e) && e <= now ? 'done' : !Number.isNaN(s) && s > now ? 'upcoming' : 'active'
      phases.push({ key: t.new_projecttaskid ?? `p-${i}`, label: t.new_name || 'Phase', start, end, status, pct: clamp01(pct / 100) })
    }
  })
  return { phases, milestones }
}

// ── Project health (RAG) — derived from real schedule/state ──────────────────

/** A schedule-health (RAG) verdict for a project tile. */
export interface ProjectHealth {
  key: 'green' | 'amber' | 'red' | 'done'
  label: string
  detail: string
  dot: string
  chip: string
}

/**
 * RAG status derived from the project's real state + finish date: completed →
 * done; past finish → red; within 30 days → amber; else green.
 */
export function projectHealth(p: Project): ProjectHealth {
  const state = `${p.statuscode_label ?? ''} ${p.statecode_label ?? ''}`.toLowerCase()
  if (/complete|closed|finished|delivered|inactive/.test(state)) {
    return { key: 'done', label: 'Complete', detail: 'Delivered', dot: 'bg-rc-teal', chip: 'bg-rc-blue-light text-rc-teal' }
  }
  if (p.msdyn_finish) {
    const days = Math.round((new Date(p.msdyn_finish).getTime() - Date.now()) / 86_400_000)
    if (days < 0) return { key: 'red', label: 'Overdue', detail: `Overdue by ${humanDuration(days)}`, dot: 'bg-red-500', chip: 'bg-red-50 text-red-700' }
    if (days <= 30) return { key: 'amber', label: 'Due soon', detail: `Due in ${humanDuration(days)}`, dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' }
    return { key: 'green', label: 'On track', detail: `${humanDuration(days)} remaining`, dot: 'bg-rc-green', chip: 'bg-rc-green-light text-rc-green-dark' }
  }
  return { key: 'green', label: 'On track', detail: 'Scheduled', dot: 'bg-rc-green', chip: 'bg-rc-green-light text-rc-green-dark' }
}

// ── Real project notes (annotations) → diary entries ─────────────────────────

export type DiaryKind = 'milestone' | 'update' | 'risk' | 'note'

/** A dated entry in the project diary/activity feed (a real annotation). */
export interface DiaryEntry {
  key: string
  date: string
  title: string
  detail: string
  author: string
  kind: DiaryKind
}

/** Columns read for a project's notes. */
export const PROJECT_NOTE_SELECT = ['annotationid', 'subject', 'notetext', 'createdon']

function kindFromSubject(subject: string | undefined): DiaryKind {
  const t = (subject ?? '').toLowerCase()
  if (t.includes('milestone')) return 'milestone'
  if (t.includes('risk')) return 'risk'
  if (t.includes('status') || t.includes('workstream') || t.includes('update')) return 'update'
  return 'note'
}

/**
 * List the real delivery notes on a project (newest first), scoped to the tier
 * the project resolved at, mapped to the diary shape. Notes are annotations
 * regarding the project (see the projectnotes route); `createdon` carries the
 * backdated date.
 */
export async function listProjectNotes(
  client: DataverseClient,
  projectId: string,
  mine: boolean,
): Promise<DiaryEntry[]> {
  const res = await client[mine ? 'me' : 'team'].list<Projectnotes>('projectnotes', {
    select: PROJECT_NOTE_SELECT,
    filter: { field: 'objectid', operator: 'eq', value: projectId },
    orderBy: { field: 'createdon', direction: 'desc' },
    top: 50,
  })
  return res.data.map((n, i) => ({
    key: n.annotationid ?? `note-${i}`,
    date: n.createdon ?? '',
    title: n.subject || 'Update',
    detail: cleanDescription(n.notetext),
    author: '',
    kind: kindFromSubject(n.subject),
  }))
}
