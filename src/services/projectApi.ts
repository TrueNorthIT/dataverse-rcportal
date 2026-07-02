import type { Project } from '../types/project'
import { humanDuration } from '../lib/format'

/** Columns the portal reads for projects (Dataverse `msdyn_project`). */
export const PROJECT_SELECT = [
  'msdyn_projectid',
  'msdyn_subject',
  'msdyn_scheduledstart',
  'msdyn_finish',
  'statecode',
  'statuscode',
  'statuscode_label',
  'statecode_label',
  'createdon',
]

/** Default list ordering — soonest to start first. */
export const PROJECT_ORDER = { field: 'msdyn_scheduledstart', direction: 'asc' } as const

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
