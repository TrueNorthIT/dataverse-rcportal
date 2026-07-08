import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Opportunity } from '../types/dataverse.generated'
import { OpportunityStatecode } from '../types/dataverse.generated'
import type { Pill } from './pills'
import { fetchDetail, type Detail } from './detail'

/**
 * Filter pills for opportunities — by state (Open/Won/Lost). Keys match the
 * list `?f=` values.
 */
export const OPPORTUNITY_PILLS: Pill[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open', filter: { field: 'statecode', operator: 'eq', value: OpportunityStatecode.Open } },
  { key: 'won', label: 'Won', filter: { field: 'statecode', operator: 'eq', value: OpportunityStatecode.Won } },
  { key: 'lost', label: 'Lost', filter: { field: 'statecode', operator: 'eq', value: OpportunityStatecode.Lost } },
]

/** Columns the portal reads for opportunities (list). */
export const OPPORTUNITY_SELECT = [
  'opportunityid',
  'name',
  'description',
  'estimatedvalue',
  'estimatedclosedate',
  'statecode',
  'statuscode',
  'createdon',
]

/** Richer column set for the opportunity detail view. */
export const OPPORTUNITY_DETAIL_SELECT = [...OPPORTUNITY_SELECT, 'modifiedon']

/** Summary columns for the "source opportunity" card on a quote. */
export const OPP_SUMMARY_SELECT = [
  'opportunityid',
  'name',
  'estimatedvalue',
  'estimatedclosedate',
  'statuscode',
]

/**
 * Fetch a single opportunity for the detail view, tolerating company (team)
 * records. Opportunities are personal — the caller is usually the primary
 * contact — so a deep link tries `me` first, then falls back to `team`.
 *
 * Read-only for portal customers: an opportunity is Redcentric's own sales
 * pipeline pursuing the customer, so there are no create/update helpers here
 * by design. Customers raise support cases instead — see caseApi.
 */
export function fetchOpportunityDetail(
  client: DataverseClient,
  id: string,
  preferTier?: 'me' | 'team',
): Promise<Detail<Opportunity>> {
  return fetchDetail<Opportunity>(client, 'opportunity', id, OPPORTUNITY_DETAIL_SELECT, {
    defaultTier: 'me',
    preferTier,
  })
}

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
