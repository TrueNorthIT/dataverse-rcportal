import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { fetchSiteDetail, siteConnectivity, deriveSiteServices } from '../services/siteApi'
import { formatDate } from '../lib/format'
import { Card } from '../components/common/Card'
import { Icon } from '../components/common/Icon'
import {
  DetailHeader,
  DetailNav,
  DetailSkeleton,
  MetaGrid,
  MetaItem,
  SectionTitle,
} from '../components/detail/DetailChrome'

/** Read-only site detail: full address, connectivity, and services at the site. */
export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const client = useDataverseClient()
  const { selectedContactId } = useSelectedCompany()
  const { tier, prevId, nextId, goPrev, goNext, goBack } = useListNav('/sites', id)

  const query = useQuery({
    queryKey: ['site', id, tier ?? 'auto', selectedContactId ?? 'default'],
    queryFn: () => fetchSiteDetail(client, id!, tier),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const error = query.error instanceof Error ? query.error.message : null
  const link = record ? siteConnectivity(record.name) : null
  const services = record ? deriveSiteServices(record) : []
  const fullAddress = record
    ? [record.line1, record.line2, record.city, record.stateorprovince, record.postalcode, record.country]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <div>
      <DetailNav label="Sites" prevId={prevId} nextId={nextId} onPrev={goPrev} onNext={goNext} onBack={goBack} />

      {query.isLoading && <DetailSkeleton />}
      {error && <p className="text-sm text-red-200">{error}</p>}

      {record && (
        <DetailHeader
          icon="mapPin"
          title={record.name || 'Site'}
          trailing={
            link && (
              <span
                title={link.full}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rc-blue-light px-2.5 py-0.5 text-xs font-medium text-rc-navy"
              >
                <Icon name="activity" className="h-3 w-3" />
                {link.label}
              </span>
            )
          }
        >
          <MetaGrid>
            <MetaItem icon="mapPin" label="Address" value={fullAddress} />
            <MetaItem icon="building" label="City" value={record.city} />
            <MetaItem icon="tag" label="County" value={record.stateorprovince} />
            <MetaItem icon="hash" label="Postcode" value={record.postalcode} />
            <MetaItem icon="globe" label="Country" value={record.country} />
            <MetaItem icon="phone" label="Site phone" value={record.telephone1} />
            <MetaItem icon="mapPin" label="Type" value={record.addresstypecode_label && `${record.addresstypecode_label} address`} />
            <MetaItem icon="clock" label="Added" value={formatDate(record.createdon)} />
          </MetaGrid>
        </DetailHeader>
      )}

      {record && services.length > 0 && (
        <div className="mt-6">
          <SectionTitle icon="activity" count={services.length}>Services at this site</SectionTitle>
          <Card className="overflow-hidden">
            <div className="divide-y divide-rc-blue-light">
              {services.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-rc-navy">{s.name}</div>
                    <div className="text-xs text-rc-teal">{s.detail} · {s.ref}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.status === 'Active' ? 'bg-rc-green-light text-rc-green-dark' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <p className="mt-2 text-[11px] text-rc-teal/70">Illustrative connectivity/services for this location.</p>
        </div>
      )}
    </div>
  )
}
