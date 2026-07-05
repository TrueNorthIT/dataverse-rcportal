import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilterCondition } from '@truenorth-it/dataverse-client'
import type { Project } from '../types/project'
import type { Projectnotes, Projecttask } from '../types/dataverse.generated'
import {
  PROJECT_SELECT,
  PROJECT_DETAIL_SELECT,
  PROJECT_ORDER,
  PROJECT_TASK_SELECT,
  PROJECT_NOTE_SELECT,
  buildProjectPills,
  fetchProjectDetail,
  listProjectTasks,
  projectHealth,
  listProjectNotes,
} from './projectApi'
import { makeClient, paginated, single } from '../test/dataverse'

const FIXED_NOW = '2026-07-05T12:00:00Z'

const first = (f: FilterCondition | FilterCondition[] | undefined): FilterCondition => {
  if (!f) throw new Error('expected a filter')
  return Array.isArray(f) ? f[0] : f
}

describe('column sets & ordering', () => {
  it('PROJECT_SELECT lists the list-view columns', () => {
    expect(PROJECT_SELECT).toContain('msdyn_projectid')
    expect(PROJECT_SELECT).toContain('msdyn_subject')
    expect(PROJECT_SELECT).toContain('statecode')
  })

  it('PROJECT_DETAIL_SELECT extends the list set with actual dates', () => {
    for (const col of PROJECT_SELECT) expect(PROJECT_DETAIL_SELECT).toContain(col)
    expect(PROJECT_DETAIL_SELECT).toContain('msdyn_actualstart')
    expect(PROJECT_DETAIL_SELECT).toContain('modifiedon')
  })

  it('PROJECT_ORDER sorts by scheduled start, ascending', () => {
    expect(PROJECT_ORDER).toEqual({ field: 'msdyn_scheduledstart', direction: 'asc' })
  })
})

describe('buildProjectPills', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_NOW))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with a filter-less "all" pill', () => {
    const pills = buildProjectPills()
    expect(pills[0]).toEqual({ key: 'all', label: 'All' })
    expect(pills[0].filter).toBeUndefined()
  })

  it('emits the five RAG pills in order', () => {
    const keys = buildProjectPills().map((p) => p.key)
    expect(keys).toEqual(['all', 'ontrack', 'duesoon', 'overdue', 'complete'])
  })

  it('uses today and today+30 as the schedule boundaries', () => {
    const pills = buildProjectPills()
    const ontrack = pills.find((p) => p.key === 'ontrack')!
    const duesoon = pills.find((p) => p.key === 'duesoon')!
    const overdue = pills.find((p) => p.key === 'overdue')!

    // On track: finish > today+30, and not delivered.
    expect(ontrack.filter).toEqual([
      { field: 'msdyn_finish', operator: 'gt', value: '2026-08-04' },
      { field: 'msdyn_actualend', operator: 'eq', value: 'null' },
    ])

    // Due soon: finish between today and today+30 inclusive, not delivered.
    expect(duesoon.filter).toEqual([
      { field: 'msdyn_finish', operator: 'ge', value: '2026-07-05' },
      { field: 'msdyn_finish', operator: 'le', value: '2026-08-04' },
      { field: 'msdyn_actualend', operator: 'eq', value: 'null' },
    ])

    // Overdue: finish before today, not delivered.
    expect(overdue.filter).toEqual([
      { field: 'msdyn_finish', operator: 'lt', value: '2026-07-05' },
      { field: 'msdyn_actualend', operator: 'eq', value: 'null' },
    ])
  })

  it('the complete pill keys off actualend being set', () => {
    const complete = buildProjectPills().find((p) => p.key === 'complete')!
    expect(complete.filter).toEqual({ field: 'msdyn_actualend', operator: 'ne', value: 'null' })
  })

  it('every in-flight pill excludes delivered projects (actualend eq null)', () => {
    const pills = buildProjectPills().filter((p) => ['ontrack', 'duesoon', 'overdue'].includes(p.key))
    for (const p of pills) {
      const conds = Array.isArray(p.filter) ? p.filter : []
      expect(conds).toContainEqual({ field: 'msdyn_actualend', operator: 'eq', value: 'null' })
    }
  })
})

describe('fetchProjectDetail', () => {
  it('honours an explicit "me" tier hint and marks the record mine', async () => {
    const client = makeClient()
    client.me.get.mockResolvedValue(single<Project>({ msdyn_projectid: 'p1', msdyn_subject: 'Mine' }))

    const { record, mine } = await fetchProjectDetail(client, 'p1', 'me')

    expect(mine).toBe(true)
    expect(record.msdyn_subject).toBe('Mine')
    expect(client.me.get).toHaveBeenCalledWith('project', 'p1', { select: PROJECT_DETAIL_SELECT })
    expect(client.team.get).not.toHaveBeenCalled()
  })

  it('honours an explicit "team" tier hint and marks the record not-mine', async () => {
    const client = makeClient()
    client.team.get.mockResolvedValue(single<Project>({ msdyn_projectid: 'p2' }))

    const { mine } = await fetchProjectDetail(client, 'p2', 'team')

    expect(mine).toBe(false)
    expect(client.team.get).toHaveBeenCalledWith('project', 'p2', { select: PROJECT_DETAIL_SELECT })
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('on a deep link tries team first (not mine)', async () => {
    const client = makeClient()
    client.team.get.mockResolvedValue(single<Project>({ msdyn_projectid: 'p3' }))

    const { record, mine } = await fetchProjectDetail(client, 'p3')

    expect(mine).toBe(false)
    expect(record.msdyn_projectid).toBe('p3')
    expect(client.team.get).toHaveBeenCalledTimes(1)
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('falls back to me when team cannot read it (mine)', async () => {
    const client = makeClient()
    client.team.get.mockRejectedValue(new Error('403'))
    client.me.get.mockResolvedValue(single<Project>({ msdyn_projectid: 'p4' }))

    const { record, mine } = await fetchProjectDetail(client, 'p4')

    expect(mine).toBe(true)
    expect(record.msdyn_projectid).toBe('p4')
    expect(client.team.get).toHaveBeenCalledTimes(1)
    expect(client.me.get).toHaveBeenCalledWith('project', 'p4', { select: PROJECT_DETAIL_SELECT })
  })
})

describe('listProjectTasks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_NOW))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('queries the team tier for a company project with the task select/filter/order', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(paginated<Projecttask>([]))

    const out = await listProjectTasks(client, 'proj-1', false)

    expect(out).toEqual({ phases: [], milestones: [] })
    expect(client.team.list).toHaveBeenCalledWith('projecttask', {
      select: PROJECT_TASK_SELECT,
      filter: { field: 'new_projectid', operator: 'eq', value: 'proj-1' },
      orderBy: { field: 'new_sequence', direction: 'asc' },
      top: 100,
    })
    expect(client.me.list).not.toHaveBeenCalled()
  })

  it('queries the me tier when the project resolved as mine', async () => {
    const client = makeClient()
    client.me.list.mockResolvedValue(paginated<Projecttask>([]))

    await listProjectTasks(client, 'proj-2', true)

    expect(client.me.list).toHaveBeenCalledTimes(1)
    expect(client.team.list).not.toHaveBeenCalled()
  })

  it('splits milestones from phases and derives milestone done-ness', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(
      paginated<Projecttask>([
        // Past milestone → done via date, even at 0%.
        { new_projecttaskid: 'm1', new_name: 'Kickoff', new_ismilestone: true, new_startdate: '2026-01-01', new_percentcomplete: 0 },
        // Future milestone at 100% → done via pct.
        { new_projecttaskid: 'm2', new_name: 'Launch', new_ismilestone: true, new_startdate: '2026-12-31', new_percentcomplete: 100 },
        // Future milestone not complete → not done.
        { new_projecttaskid: 'm3', new_name: 'Review', new_ismilestone: true, new_startdate: '2026-12-31', new_percentcomplete: 10 },
      ]),
    )

    const { milestones, phases } = await listProjectTasks(client, 'p', false)

    expect(phases).toHaveLength(0)
    expect(milestones).toEqual([
      { key: 'm1', label: 'Kickoff', date: '2026-01-01', done: true },
      { key: 'm2', label: 'Launch', date: '2026-12-31', done: true },
      { key: 'm3', label: 'Review', date: '2026-12-31', done: false },
    ])
  })

  it('classifies phase status as done / active / upcoming from the schedule', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(
      paginated<Projecttask>([
        // Ended in the past → done.
        { new_projecttaskid: 'p1', new_name: 'Discovery', new_ismilestone: false, new_startdate: '2026-01-01', new_enddate: '2026-02-01', new_percentcomplete: 100 },
        // Started, not yet ended → active.
        { new_projecttaskid: 'p2', new_name: 'Build', new_ismilestone: false, new_startdate: '2026-06-01', new_enddate: '2026-12-01', new_percentcomplete: 50 },
        // Starts in the future → upcoming.
        { new_projecttaskid: 'p3', new_name: 'Handover', new_ismilestone: false, new_startdate: '2026-12-01', new_enddate: '2026-12-15', new_percentcomplete: 0 },
      ]),
    )

    const { phases } = await listProjectTasks(client, 'p', false)

    expect(phases.map((p) => p.status)).toEqual(['done', 'active', 'upcoming'])
    // pct is clamped to 0–1.
    expect(phases[1].pct).toBe(0.5)
    expect(phases[0].pct).toBe(1)
  })

  it('clamps percent-complete into 0–1 for phase bars', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(
      paginated<Projecttask>([
        { new_projecttaskid: 'over', new_ismilestone: false, new_startdate: '2026-06-01', new_enddate: '2026-12-01', new_percentcomplete: 150 },
        { new_projecttaskid: 'neg', new_ismilestone: false, new_startdate: '2026-06-01', new_enddate: '2026-12-01', new_percentcomplete: -20 },
      ]),
    )

    const { phases } = await listProjectTasks(client, 'p', false)

    expect(phases[0].pct).toBe(1)
    expect(phases[1].pct).toBe(0)
  })

  it('falls back to synthesised keys and default labels/dates when fields are missing', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(
      paginated<Projecttask>([
        // Milestone with no id/name/date → default key m-0, label, empty date, and
        // (no date) NaN ts → not done at 0%.
        { new_ismilestone: true },
        // Phase with no id/name and no end → key p-1, "Phase" label, end defaults to
        // start (both empty → NaN → active).
        { new_ismilestone: false },
      ]),
    )

    const { milestones, phases } = await listProjectTasks(client, 'p', false)

    expect(milestones[0]).toEqual({ key: 'm-0', label: 'Milestone', date: '', done: false })
    expect(phases[0]).toEqual({ key: 'p-1', label: 'Phase', start: '', end: '', status: 'active', pct: 0 })
  })

  it('treats a phase whose start equals its end in the past as done', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(
      paginated<Projecttask>([
        // No end date → end defaults to start; start in the past → done.
        { new_projecttaskid: 'z', new_ismilestone: false, new_startdate: '2026-01-01' },
      ]),
    )

    const { phases } = await listProjectTasks(client, 'p', false)
    expect(phases[0].status).toBe('done')
    expect(phases[0].end).toBe('2026-01-01')
  })
})

describe('projectHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_NOW))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports Complete for a delivered project (actualend set)', () => {
    const h = projectHealth({ msdyn_actualend: '2026-06-01' })
    expect(h.key).toBe('done')
    expect(h.label).toBe('Complete')
    expect(h.detail).toBe('Delivered 1 Jun 2026')
    expect(h.dot).toContain('teal')
  })

  it('reports Overdue when the finish date is in the past', () => {
    const h = projectHealth({ msdyn_finish: '2026-06-05' })
    expect(h.key).toBe('red')
    expect(h.label).toBe('Overdue')
    expect(h.detail).toMatch(/^Overdue by /)
    expect(h.dot).toBe('bg-red-500')
  })

  it('reports Due soon within 30 days of finish', () => {
    const h = projectHealth({ msdyn_finish: '2026-07-20' })
    expect(h.key).toBe('amber')
    expect(h.label).toBe('Due soon')
    expect(h.detail).toMatch(/^Due in /)
  })

  it('reports On track beyond the 30-day window', () => {
    const h = projectHealth({ msdyn_finish: '2026-10-01' })
    expect(h.key).toBe('green')
    expect(h.label).toBe('On track')
    expect(h.detail).toMatch(/remaining$/)
  })

  it('reports On track / Scheduled when there is no finish date', () => {
    const h = projectHealth({})
    expect(h.key).toBe('green')
    expect(h.label).toBe('On track')
    expect(h.detail).toBe('Scheduled')
  })

  it('treats a finish exactly 30 days out as Due soon (boundary)', () => {
    const h = projectHealth({ msdyn_finish: '2026-08-04T12:00:00Z' })
    expect(h.key).toBe('amber')
  })
})

describe('listProjectNotes', () => {
  it('reads team-tier notes newest-first with the note select/filter', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(paginated<Projectnotes>([]))

    const out = await listProjectNotes(client, 'proj-9', false)

    expect(out).toEqual([])
    expect(client.team.list).toHaveBeenCalledWith('projectnotes', {
      select: PROJECT_NOTE_SELECT,
      filter: { field: 'objectid', operator: 'eq', value: 'proj-9' },
      orderBy: { field: 'createdon', direction: 'desc' },
      top: 50,
    })
  })

  it('reads me-tier notes when the project is mine', async () => {
    const client = makeClient()
    client.me.list.mockResolvedValue(paginated<Projectnotes>([]))

    await listProjectNotes(client, 'proj-9', true)

    expect(client.me.list).toHaveBeenCalledTimes(1)
    expect(client.team.list).not.toHaveBeenCalled()
  })

  it('maps annotations to diary entries and cleans the body', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(
      paginated<Projectnotes>([
        {
          annotationid: 'a1',
          subject: 'Milestone reached',
          notetext: '[DEMO-RCPORTAL] Phase one signed off.',
          createdon: '2026-06-01T09:00:00Z',
        },
      ]),
    )

    const [entry] = await listProjectNotes(client, 'p', false)

    expect(entry).toEqual({
      key: 'a1',
      date: '2026-06-01T09:00:00Z',
      title: 'Milestone reached',
      detail: 'Phase one signed off.',
      author: '',
      kind: 'milestone',
    })
  })

  it('classifies note kind from the subject keywords', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(
      paginated<Projectnotes>([
        { annotationid: 'r', subject: 'Risk raised', notetext: 'x' },
        { annotationid: 'u1', subject: 'Weekly status', notetext: 'x' },
        { annotationid: 'u2', subject: 'Workstream progress', notetext: 'x' },
        { annotationid: 'u3', subject: 'General update', notetext: 'x' },
        { annotationid: 'n', subject: 'Random remark', notetext: 'x' },
      ]),
    )

    const kinds = (await listProjectNotes(client, 'p', false)).map((e) => e.kind)
    expect(kinds).toEqual(['risk', 'update', 'update', 'update', 'note'])
  })

  it('falls back to a synthesised key, default title and undefined subject → note kind', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(paginated<Projectnotes>([{ notetext: 'body' }]))

    const [entry] = await listProjectNotes(client, 'p', false)

    expect(entry.key).toBe('note-0')
    expect(entry.title).toBe('Update')
    expect(entry.date).toBe('')
    expect(entry.kind).toBe('note')
  })
})

describe('shared filter shape', () => {
  it('every project pill filter (when present) has a field/operator/value', () => {
    const pills = buildProjectPills().filter((p) => p.filter)
    for (const p of pills) {
      const cond = first(p.filter)
      expect(cond).toHaveProperty('field')
      expect(cond).toHaveProperty('operator')
      expect(cond).toHaveProperty('value')
    }
  })
})
