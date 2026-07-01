import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Case, NewCase } from '../types/case'

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
