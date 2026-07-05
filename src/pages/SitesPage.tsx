import { ListScreen } from '../components/common/ListScreen'
import type { SortOption } from '../hooks/useList'
import { SITE_SELECT, buildSitePills } from '../services/siteApi'
import type { Site } from '../types/site'
import { Icon } from '../components/common/Icon'

const SITE_SORTS: SortOption[] = [
  { key: 'name', label: 'Name (A–Z)', order: { field: 'name', direction: 'asc' } },
  { key: 'added', label: 'Recently added', order: { field: 'createdon', direction: 'desc' } },
]

/** One site row: name, composed address, type, and a connectivity chip. */
function SiteRow({ site: s }: { site: Site }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium text-rc-navy">{s.name || 'Site'}</div>
        <div className="mt-1 text-sm text-rc-teal">
          {[s.line1, s.city, s.postalcode].filter(Boolean).join(', ')}
        </div>
        {s.addresstypecode_label && (
          <div className="mt-0.5 text-xs text-rc-teal/80">{s.addresstypecode_label} address</div>
        )}
      </div>
      {s.new_connectivitytype_label && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rc-blue-light px-2.5 py-0.5 text-xs font-medium text-rc-navy">
          <Icon name="activity" className="h-3 w-3" />
          {s.new_connectivitytype_label}
        </span>
      )}
    </div>
  )
}

/**
 * Sites list — the customer's locations/premises. Company-level, so it opens on
 * the Company tier. Connectivity is filtered over the loaded rows (the API
 * can't cheaply filter on the resolved label), via `clientFilter`.
 */
export function SitesPage() {
  return (
    <ListScreen<Site>
      title="Sites"
      subtitle={{ me: 'Your locations', team: "Your company's locations" }}
      basePath="/sites"
      table="site"
      select={SITE_SELECT}
      pills={buildSitePills()}
      sorts={SITE_SORTS}
      defaultSort="name"
      defaultTier="team"
      clientFilter={(s, key) => s.new_connectivitytype_label === key}
      getId={(s) => s.customeraddressid ?? ''}
      emptyMessage={(f) => (f === 'all' ? 'No sites to show yet.' : 'No sites with that connectivity.')}
      renderRow={(s) => <SiteRow site={s} />}
    />
  )
}
