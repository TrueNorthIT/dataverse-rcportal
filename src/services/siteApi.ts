import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Site } from '../types/site'
import type { Pill } from './pills'

/** Columns the portal reads for sites (Dataverse `customeraddress`). */
export const SITE_SELECT = [
  'customeraddressid',
  'name',
  'line1',
  'city',
  'postalcode',
  'addresstypecode',
  'new_connectivitytype',
  'createdon',
]

/** Richer column set for the site detail view (full address + geo + phone). */
export const SITE_DETAIL_SELECT = [
  ...SITE_SELECT,
  'line2',
  'stateorprovince',
  'country',
  'telephone1',
  'latitude',
  'longitude',
]

/** Default list ordering — alphabetical by site name. */
export const SITE_ORDER = { field: 'name', direction: 'asc' } as const

/**
 * Connectivity type labels for the filter pills — these mirror the real
 * `new_connectivitytype` option set on customeraddress (seeded per site), so
 * the value shown always maps to Dataverse. Rows carry the value in
 * `new_connectivitytype_label`.
 */
export const CONNECTIVITY_LABELS = ['FTTP', 'FTTC', 'Leased Line', 'Dark Fibre', 'EFM']

/**
 * Filter pills for sites — one per connectivity type. The `key` is the label
 * (the list filters client-side by `new_connectivitytype_label`, and the `?f=`
 * value is the label). The `filter` targets the real `new_connectivitytype`
 * choice value (100000000 + index, matching the seeders) for server-side counts
 * on the dashboard's connectivity chart.
 */
export function buildSitePills(): Pill[] {
  return [
    { key: 'all', label: 'All' },
    ...CONNECTIVITY_LABELS.map((l, i): Pill => ({
      key: l,
      label: l,
      filter: { field: 'new_connectivitytype', operator: 'eq', value: 100000000 + i },
    })),
  ]
}

/**
 * Fetch a single site for the detail view. Sites are company-level, so `team`
 * is the reliable tier; with a hint we honour it, else team then me.
 */
export async function fetchSiteDetail(
  client: DataverseClient,
  id: string,
  preferTier?: 'me' | 'team',
): Promise<{ record: Site; mine: boolean }> {
  if (preferTier) {
    const res = await client[preferTier].get<Site>('site', id, { select: SITE_DETAIL_SELECT })
    return { record: res.data, mine: preferTier === 'me' }
  }
  try {
    const res = await client.team.get<Site>('site', id, { select: SITE_DETAIL_SELECT })
    return { record: res.data, mine: false }
  } catch {
    const res = await client.me.get<Site>('site', id, { select: SITE_DETAIL_SELECT })
    return { record: res.data, mine: true }
  }
}
