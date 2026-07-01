import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Quote } from '../types/quote'

/** Columns the portal reads for quotes. */
export const QUOTE_SELECT = [
  'quoteid',
  'name',
  'quotenumber',
  'totalamount',
  'statecode',
  'statuscode',
  'createdon',
]

/** List quotes tied to a single opportunity (both tiers support the filter). */
export async function listQuotesForOpportunity(
  client: DataverseClient,
  opportunityId: string,
): Promise<Quote[]> {
  const res = await client.me.list<Quote>('quote', {
    select: QUOTE_SELECT,
    filter: { field: '_opportunityid_value', operator: 'eq', value: opportunityId },
    top: 50,
  })
  return res.data
}
