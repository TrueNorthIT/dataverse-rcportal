import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Opportunity } from '../types/dataverse.generated'

/** Summary columns for the "source opportunity" card on a quote. */
export const OPP_SUMMARY_SELECT = [
  'opportunityid',
  'name',
  'estimatedvalue',
  'estimatedclosedate',
  'statuscode',
]

/**
 * Fetch an opportunity summary by id, tolerating tier access. Returns null if
 * it can't be read (e.g. not visible at the caller's tier) — the caller treats
 * the source opportunity as optional dressing.
 */
export async function fetchOpportunitySummary(
  client: DataverseClient,
  id: string,
  mine: boolean,
): Promise<Opportunity | null> {
  try {
    const res = await client[mine ? 'me' : 'team'].get<Opportunity>('opportunity', id, {
      select: OPP_SUMMARY_SELECT,
    })
    return res.data
  } catch {
    try {
      const res = await client.team.get<Opportunity>('opportunity', id, { select: OPP_SUMMARY_SELECT })
      return res.data
    } catch {
      return null
    }
  }
}
