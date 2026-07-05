import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient, paginated, single, type MockClient } from '../test/dataverse'
import { CasePrioritycode } from '../types/dataverse.generated'
import type { Case } from '../types/case'
import type { CaseNote } from '../types/caseNote'
import {
  CASE_PILLS,
  CASE_NOTE_SELECT,
  CASE_SELECT,
  listCaseNotes,
  updateCase,
  addCaseNote,
  getCase,
  fetchCaseDetail,
  createCase,
} from './caseApi'

describe('caseApi constants', () => {
  it('exposes an "all" pill first, then one per priority mapped to its choice value', () => {
    expect(CASE_PILLS[0]).toEqual({ key: 'all', label: 'All' })
    const byKey = Object.fromEntries(CASE_PILLS.map((p) => [p.key, p]))
    expect(byKey.high.filter).toEqual({ field: 'prioritycode', operator: 'eq', value: CasePrioritycode.High })
    expect(byKey.normal.filter).toEqual({ field: 'prioritycode', operator: 'eq', value: CasePrioritycode.Normal })
    expect(byKey.low.filter).toEqual({ field: 'prioritycode', operator: 'eq', value: CasePrioritycode.Low })
  })

  it('the "all" pill never carries a filter', () => {
    expect(CASE_PILLS.find((p) => p.key === 'all')?.filter).toBeUndefined()
  })

  it('reads the columns the timeline and case views need', () => {
    expect(CASE_NOTE_SELECT).toContain('notetext')
    expect(CASE_NOTE_SELECT).toContain('createdon')
    expect(CASE_SELECT).toContain('ticketnumber')
    expect(CASE_SELECT).toContain('prioritycode')
  })
})

describe('listCaseNotes', () => {
  let client: MockClient
  beforeEach(() => {
    client = makeClient()
  })

  it('reads notes from the "me" tier when the case is mine, newest first', async () => {
    const notes: CaseNote[] = [{ annotationid: 'n1', notetext: 'hello' }]
    client.me.list.mockResolvedValue(paginated(notes))

    const result = await listCaseNotes(client, 'case-1', true)

    expect(result).toEqual(notes)
    expect(client.me.list).toHaveBeenCalledWith('casenotes', {
      select: CASE_NOTE_SELECT,
      filter: { field: 'objectid', operator: 'eq', value: 'case-1' },
      orderBy: { field: 'createdon', direction: 'desc' },
      top: 50,
    })
    expect(client.team.list).not.toHaveBeenCalled()
  })

  it('reads notes from the "team" tier when the case is not mine', async () => {
    client.team.list.mockResolvedValue(paginated<CaseNote>([{ annotationid: 'n2' }]))

    const result = await listCaseNotes(client, 'case-2', false)

    expect(result).toEqual([{ annotationid: 'n2' }])
    expect(client.team.list).toHaveBeenCalledWith(
      'casenotes',
      expect.objectContaining({ filter: { field: 'objectid', operator: 'eq', value: 'case-2' } }),
    )
    expect(client.me.list).not.toHaveBeenCalled()
  })
})

describe('updateCase', () => {
  it('patches the case on the me tier with the supplied fields', async () => {
    const client = makeClient()
    await updateCase(client, 'case-9', { title: 'New title', description: 'desc' })
    expect(client.me.update).toHaveBeenCalledWith('case', 'case-9', {
      title: 'New title',
      description: 'desc',
    })
  })
})

describe('addCaseNote', () => {
  let client: MockClient
  beforeEach(() => {
    client = makeClient()
  })

  it('creates a note bound to the case, trimming the text', async () => {
    await addCaseNote(client, 'case-3', { subject: '  Follow up  ', notetext: '  more info  ' })
    expect(client.me.create).toHaveBeenCalledWith('casenotes', {
      subject: 'Follow up',
      notetext: 'more info',
      objectid: 'case-3',
    })
  })

  it('defaults the subject to "Update" when none is given', async () => {
    await addCaseNote(client, 'case-4', { notetext: 'body' })
    expect(client.me.create).toHaveBeenCalledWith(
      'casenotes',
      expect.objectContaining({ subject: 'Update', notetext: 'body' }),
    )
  })

  it('defaults the subject to "Update" when it is blank after trimming', async () => {
    await addCaseNote(client, 'case-5', { subject: '   ', notetext: 'body' })
    expect(client.me.create).toHaveBeenCalledWith(
      'casenotes',
      expect.objectContaining({ subject: 'Update' }),
    )
  })
})

describe('getCase', () => {
  it('fetches a single case from the me tier with the case columns', async () => {
    const client = makeClient()
    const record: Case = { incidentid: 'c1', title: 'A case' }
    client.me.get.mockResolvedValue(single(record))

    const result = await getCase(client, 'c1')

    expect(result).toEqual(record)
    expect(client.me.get).toHaveBeenCalledWith('case', 'c1', { select: CASE_SELECT })
  })
})

describe('fetchCaseDetail', () => {
  let client: MockClient
  beforeEach(() => {
    client = makeClient()
  })

  it('honours a "me" preferTier and marks the record as mine', async () => {
    client.me.get.mockResolvedValue(single<Case>({ incidentid: 'm1' }))

    const result = await fetchCaseDetail(client, 'm1', 'me')

    expect(result).toEqual({ record: { incidentid: 'm1' }, mine: true })
    expect(client.me.get).toHaveBeenCalledWith('case', 'm1', { select: CASE_SELECT })
    expect(client.team.get).not.toHaveBeenCalled()
  })

  it('honours a "team" preferTier and marks the record as not mine', async () => {
    client.team.get.mockResolvedValue(single<Case>({ incidentid: 't1' }))

    const result = await fetchCaseDetail(client, 't1', 'team')

    expect(result).toEqual({ record: { incidentid: 't1' }, mine: false })
    expect(client.team.get).toHaveBeenCalledWith('case', 't1', { select: CASE_SELECT })
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('without a hint, reads from "me" first and returns mine', async () => {
    client.me.get.mockResolvedValue(single<Case>({ incidentid: 'x1' }))

    const result = await fetchCaseDetail(client, 'x1')

    expect(result).toEqual({ record: { incidentid: 'x1' }, mine: true })
    expect(client.team.get).not.toHaveBeenCalled()
  })

  it('falls back to "team" when the "me" probe throws (a colleague/company ticket)', async () => {
    client.me.get.mockRejectedValue(new Error('404'))
    client.team.get.mockResolvedValue(single<Case>({ incidentid: 'x2' }))

    const result = await fetchCaseDetail(client, 'x2')

    expect(result).toEqual({ record: { incidentid: 'x2' }, mine: false })
    expect(client.me.get).toHaveBeenCalled()
    expect(client.team.get).toHaveBeenCalledWith('case', 'x2', { select: CASE_SELECT })
  })
})

describe('createCase', () => {
  it('creates the case on the me tier and returns the new record', async () => {
    const client = makeClient()
    const created: Case = { incidentid: 'new-1', title: 'Printer down' }
    client.me.create.mockResolvedValue(single(created))

    const result = await createCase(client, { title: 'Printer down', description: 'help' })

    expect(result).toEqual(created)
    expect(client.me.create).toHaveBeenCalledWith('case', {
      title: 'Printer down',
      description: 'help',
    })
  })
})
