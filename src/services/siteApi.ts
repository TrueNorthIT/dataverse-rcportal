/** Columns the portal reads for sites (Dataverse `customeraddress`). */
export const SITE_SELECT = [
  'customeraddressid',
  'name',
  'line1',
  'city',
  'postalcode',
  'addresstypecode',
  'createdon',
]

/** Default list ordering — alphabetical by site name. */
export const SITE_ORDER = { field: 'name', direction: 'asc' } as const

/**
 * Connectivity/circuit type for a site.
 *
 * DEMO NOTE: Dataverse `customeraddress` has no connectivity field, so we derive
 * a plausible circuit type deterministically from the site name (stable hash).
 * It's fictional demo dressing — fine for showcasing per-site connectivity and
 * the filter pills, and consistent across reloads because it's name-derived.
 */
export interface Connectivity {
  key: string
  /** Short chip label, e.g. "FTTP". */
  label: string
  /** Expanded name for tooltips, e.g. "Fibre to the Premises". */
  full: string
}

export const CONNECTIVITY_TYPES: Connectivity[] = [
  { key: 'fttp', label: 'FTTP', full: 'Fibre to the Premises' },
  { key: 'fttc', label: 'FTTC', full: 'Fibre to the Cabinet' },
  { key: 'leased', label: 'Leased Line', full: 'Ethernet leased line' },
  { key: 'dark', label: 'Dark Fibre', full: 'Dark fibre' },
  { key: 'efm', label: 'EFM', full: 'Ethernet First Mile' },
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** Deterministic connectivity type for a site, keyed on its name. */
export function siteConnectivity(name: string | null | undefined): Connectivity {
  return CONNECTIVITY_TYPES[hashString(name || 'site') % CONNECTIVITY_TYPES.length]
}
