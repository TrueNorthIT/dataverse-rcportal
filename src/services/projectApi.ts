import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Project } from '../types/project'
import { humanDuration } from '../lib/format'

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

/** A single milestone on a project timeline. */
export interface Milestone {
  key: string
  label: string
  /** ISO date this milestone is planned/actual for. */
  date: string
  /** true once the date is in the past (derived). */
  done: boolean
}

const MILESTONE_STAGES = ['Kick-off', 'Discovery complete', 'Build', 'Testing & UAT', 'Go-live', 'Handover & close']

/**
 * DEMO NOTE: msdyn_project's real task/milestone table (msdyn_projecttask) needs
 * the Project scheduling engine to populate, so — like the site connectivity
 * dressing — we derive a plausible milestone timeline deterministically from the
 * project's own schedule. Stable across reloads (keyed on the project id/dates).
 */
export function deriveMilestones(p: Project): Milestone[] {
  const start = p.msdyn_actualstart || p.msdyn_scheduledstart
  const end = p.msdyn_finish
  if (!start || !end) return []
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return []
  const now = Date.now()
  const span = e - s
  return MILESTONE_STAGES.map((label, i) => {
    const date = new Date(s + (span * i) / (MILESTONE_STAGES.length - 1)).toISOString()
    return { key: `${p.msdyn_projectid}-${i}`, label, date, done: new Date(date).getTime() <= now }
  })
}

/** A schedule-health (RAG) verdict for a project tile. */
export interface ProjectHealth {
  key: 'green' | 'amber' | 'red' | 'done'
  /** Short chip label, e.g. "On track". */
  label: string
  /** Supporting detail, e.g. "4 months remaining" / "Overdue by 12 days". */
  detail: string
  /** Tailwind classes for the status dot. */
  dot: string
  /** Tailwind classes for the chip. */
  chip: string
}

/**
 * Derive a RAG status for a project.
 *
 * msdyn_project has no native health/RAG or %-complete field exposed by the
 * API, so we infer it from the schedule + state: completed → done; past its
 * finish → red; finishing within 30 days → amber; otherwise green. This is a
 * reasonable at-a-glance signal for a customer portfolio view.
 */
export function projectHealth(p: Project): ProjectHealth {
  const state = `${p.statuscode_label ?? ''} ${p.statecode_label ?? ''}`.toLowerCase()
  if (/complete|closed|finished|delivered|inactive/.test(state)) {
    return {
      key: 'done',
      label: 'Complete',
      detail: 'Delivered',
      dot: 'bg-rc-teal',
      chip: 'bg-rc-blue-light text-rc-teal',
    }
  }

  if (p.msdyn_finish) {
    const days = Math.round((new Date(p.msdyn_finish).getTime() - Date.now()) / 86_400_000)
    if (days < 0) {
      return {
        key: 'red',
        label: 'Overdue',
        detail: `Overdue by ${humanDuration(days)}`,
        dot: 'bg-red-500',
        chip: 'bg-red-50 text-red-700',
      }
    }
    if (days <= 30) {
      return {
        key: 'amber',
        label: 'Due soon',
        detail: `Due in ${humanDuration(days)}`,
        dot: 'bg-amber-500',
        chip: 'bg-amber-50 text-amber-700',
      }
    }
    return {
      key: 'green',
      label: 'On track',
      detail: `${humanDuration(days)} remaining`,
      dot: 'bg-rc-green',
      chip: 'bg-rc-green-light text-rc-green-dark',
    }
  }

  return {
    key: 'green',
    label: 'On track',
    detail: 'Scheduled',
    dot: 'bg-rc-green',
    chip: 'bg-rc-green-light text-rc-green-dark',
  }
}
