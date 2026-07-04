import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Case, NewCase } from '../types/case'
import type { CaseNote } from '../types/caseNote'

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
export async function fetchCaseDetail(
  client: DataverseClient,
  id: string,
  preferTier?: 'me' | 'team',
): Promise<{ record: Case; mine: boolean }> {
  if (preferTier) {
    const res = await client[preferTier].get<Case>('case', id, { select: CASE_SELECT })
    return { record: res.data, mine: preferTier === 'me' }
  }
  try {
    const res = await client.me.get<Case>('case', id, { select: CASE_SELECT })
    return { record: res.data, mine: true }
  } catch {
    const res = await client.team.get<Case>('case', id, { select: CASE_SELECT })
    return { record: res.data, mine: false }
  }
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
