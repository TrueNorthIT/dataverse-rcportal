import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Opportunity } from '../types/opportunity'

/** Columns the portal reads for opportunities. */
export const OPPORTUNITY_SELECT = [
  'opportunityid',
  'name',
  'estimatedvalue',
  'estimatedclosedate',
  'statecode',
  'statuscode',
  'createdon',
]

/** Default list ordering — soonest to close first (spec §6.5). */
export const OPPORTUNITY_ORDER = { field: 'estimatedclosedate', direction: 'asc' } as const

/**
 * Fetch a single opportunity by id.
 *
 * Read-only for customers — there is no create/update helper here by design
 * (opportunities are Redcentric's pipeline; see the terraform permission model).
 */
export async function getOpportunity(
  client: DataverseClient,
  id: string,
): Promise<Opportunity> {
  const res = await client.me.get<Opportunity>('opportunity', id, {
    select: OPPORTUNITY_SELECT,
  })
  return res.data
}
