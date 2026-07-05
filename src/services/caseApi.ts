import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Case, NewCase } from '../types/case'
import type { CaseNote } from '../types/caseNote'
import type { Pill } from './pills'
import { fetchDetail } from './detail'
import { CasePrioritycode } from '../types/dataverse.generated'

/**
 * Filter pills for support cases — by priority. Keys match the list `?f=`
 * values; shared with the dashboard's Cases-by-priority chart.
 */
export const CASE_PILLS: Pill[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High', filter: { field: 'prioritycode', operator: 'eq', value: CasePrioritycode.High } },
  { key: 'normal', label: 'Normal', filter: { field: 'prioritycode', operator: 'eq', value: CasePrioritycode.Normal } },
  { key: 'low', label: 'Low', filter: { field: 'prioritycode', operator: 'eq', value: CasePrioritycode.Low } },
]

/** Columns read for the case-notes timeline. */
export const CASE_NOTE_SELECT = [
  'annotationid',
  'subject',
  'notetext',
  'objecttypecode',
  'isdocument',
  'createdon',
  'modifiedon',
]

/**
 * List the notes on a case (newest first). Scoped to the same tier the case was
 * read at — `me` for your own tickets, `team` for a colleague's/company ticket —
 * filtered to the parent case via the polymorphic regarding value.
 */
export async function listCaseNotes(
  client: DataverseClient,
  caseId: string,
  mine: boolean,
): Promise<CaseNote[]> {
  const res = await client[mine ? 'me' : 'team'].list<CaseNote>('casenotes', {
    select: CASE_NOTE_SELECT,
    // Filter by the clean lookup name `objectid` — the API translates it to the
    // OData `_objectid_value` internally; passing the raw `_value` name 400s.
    filter: { field: 'objectid', operator: 'eq', value: caseId },
    orderBy: { field: 'createdon', direction: 'desc' },
    top: 50,
  })
  return res.data
}

/** Update fields on a case you own (me tier — the `case` route allows write). */
export async function updateCase(
  client: DataverseClient,
  id: string,
  input: Partial<Pick<Case, 'title' | 'description'>>,
): Promise<void> {
  await client.me.update('case', id, input as Record<string, unknown>)
}

/**
 * Add a note (update) to a case you own. Sending `objectid` binds the note to
 * the case via objectid_incident → /incidents(id); the API resolves the entity
 * set from the casenotes route's lookup_table.
 */
export async function addCaseNote(
  client: DataverseClient,
  caseId: string,
  input: { subject?: string; notetext: string },
): Promise<void> {
  await client.me.create('casenotes', {
    subject: input.subject?.trim() || 'Update',
    notetext: input.notetext.trim(),
    objectid: caseId,
  })
}

/** Columns the portal reads for support cases. */
export const CASE_SELECT = [
  'incidentid',
  'title',
  'ticketnumber',
  'prioritycode',
  'statecode',
  'statuscode',
  'description',
  'createdon',
]

/** Fetch a single case by id. */
export async function getCase(client: DataverseClient, id: string): Promise<Case> {
  const res = await client.me.get<Case>('case', id, { select: CASE_SELECT })
  return res.data
}

/**
 * Fetch a case for the detail view, tolerating company (team) tickets.
 *
 * `me` only resolves cases the caller raised, so opening a colleague's / the
 * company's ticket 404s there. When the list tells us which tier it was showing
 * (`preferTier`), we fetch straight from that tier — no failed `me` probe (and
 * no 404 noise in the console). Without a hint (deep link / refresh) we try
 * `me` then fall back to `team`. `mine` says whether it's the caller's own
 * ticket, so the UI can note the difference.
 */
export function fetchCaseDetail(
  client: DataverseClient,
  id: string,
  preferTier?: 'me' | 'team',
): Promise<{ record: Case; mine: boolean }> {
  // Cases are personal — try the caller's own tier first.
  return fetchDetail<Case>(client, 'case', id, CASE_SELECT, { defaultTier: 'me', preferTier })
}

/**
 * Raise a support case for the signed-in customer.
 *
 * Auto-binding on the `rcportal` scope sets the primary contact + customer
 * account from the verified token — the form only supplies content fields.
 */
export async function createCase(
  client: DataverseClient,
  input: NewCase,
): Promise<Case> {
  const res = await client.me.create<Case>(
    'case',
    input as unknown as Record<string, unknown>,
  )
  return res.data
}
