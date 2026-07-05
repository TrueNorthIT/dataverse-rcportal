import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Quote, QuoteLine } from '../types/quote'
import type { Pill } from './pills'
import { fetchDetail } from './detail'
import { QuoteStatecode } from '../types/dataverse.generated'

/**
 * Filter pills for quotes — by state. Keys match the list `?f=` values; shared
 * with the dashboard's Quotes-by-state chart.
 */
export const QUOTE_PILLS: Pill[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active', filter: { field: 'statecode', operator: 'eq', value: QuoteStatecode.Active } },
  { key: 'draft', label: 'Draft', filter: { field: 'statecode', operator: 'eq', value: QuoteStatecode.Draft } },
]

/** Columns the portal reads for quotes (list). */
export const QUOTE_SELECT = [
  'quoteid',
  'name',
  'description',
  'quotenumber',
  'totalamount',
  'statecode',
  'statuscode',
  'createdon',
]

/** Richer column set for the quote detail view. */
export const QUOTE_DETAIL_SELECT = [
  ...QUOTE_SELECT,
  'effectivefrom',
  'effectiveto',
  'discountamount',
  'totaltax',
  'freightamount',
  'opportunityid',
  'modifiedon',
]

/** Columns read for a quote's line items. */
export const QUOTE_LINE_SELECT = [
  'quotedetailid',
  'productdescription',
  'priceperunit',
  'quantity',
  'extendedamount',
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

/**
 * Fetch a single quote for the detail view, tolerating company (team) quotes.
 * Mirrors the case pattern: with a tier hint from the list we fetch straight
 * from that tier; on a deep link we try `me` then fall back to `team`.
 */
export function fetchQuoteDetail(
  client: DataverseClient,
  id: string,
  preferTier?: 'me' | 'team',
): Promise<{ record: Quote; mine: boolean }> {
  // Quotes are personal — try the caller's own tier first.
  return fetchDetail<Quote>(client, 'quote', id, QUOTE_DETAIL_SELECT, { defaultTier: 'me', preferTier })
}

/** List the line items on a quote (scoped to the same tier the quote resolved at). */
export async function listQuoteLines(
  client: DataverseClient,
  quoteId: string,
  mine: boolean,
): Promise<QuoteLine[]> {
  const res = await client[mine ? 'me' : 'team'].list<QuoteLine>('quotedetail', {
    select: QUOTE_LINE_SELECT,
    filter: { field: 'quoteid', operator: 'eq', value: quoteId },
    orderBy: { field: 'createdon', direction: 'asc' },
    top: 50,
  })
  return res.data
}
