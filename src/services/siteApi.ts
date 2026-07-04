import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Site } from '../types/site'

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

/** A connectivity/managed service running at a site (demo dressing). */
export interface SiteService {
  key: string
  name: string
  detail: string
  status: 'Active' | 'Provisioning'
  ref: string
}

const BANDWIDTHS = ['100 Mbps', '200 Mbps', '500 Mbps', '1 Gbps', '10 Gbps']
const EXTRAS = [
  { name: 'Managed Firewall', detail: 'Fortinet FortiGate, 24/7 managed' },
  { name: 'SD-WAN', detail: 'Redcentric SD-WAN overlay' },
  { name: 'Managed Wi-Fi', detail: 'Cloud-managed access points' },
  { name: 'DDoS Protection', detail: 'Always-on scrubbing' },
  { name: 'Voice (SIP)', detail: 'SIP trunks + hosted voice' },
]

/**
 * DEMO NOTE: there's no per-site service table, so we derive a stable, plausible
 * set of connectivity + managed services from the site id/name — same approach
 * as the connectivity dressing. Deterministic across reloads.
 */
export function deriveSiteServices(site: Site): SiteService[] {
  const id = site.customeraddressid || site.name || 'site'
  const h = hashString(id)
  const conn = siteConnectivity(site.name)
  const bw = BANDWIDTHS[h % BANDWIDTHS.length]
  const services: SiteService[] = [
    {
      key: 'primary',
      name: `${conn.label} circuit`,
      detail: `${conn.full} · ${bw}`,
      status: 'Active',
      ref: `CIR-${100000 + (h % 900000)}`,
    },
  ]
  // 0–2 extra managed services, deterministically chosen.
  const extraCount = h % 3
  for (let i = 0; i < extraCount; i++) {
    const ex = EXTRAS[(h + i * 7) % EXTRAS.length]
    services.push({
      key: `extra-${i}`,
      name: ex.name,
      detail: ex.detail,
      status: (h + i) % 5 === 0 ? 'Provisioning' : 'Active',
      ref: `SVC-${100000 + ((h + i * 31) % 900000)}`,
    })
  }
  return services
}
