import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { fetchSiteDetail } from '../services/siteApi'
import { formatDate } from '../lib/format'
import { Icon } from '../components/common/Icon'
import {
  DetailHeader,
  DetailNav,
  DetailStates,
  MetaGrid,
  MetaItem,
} from '../components/detail/DetailChrome'

/** Read-only site detail: full address + connectivity (all real DV fields). */
export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const client = useDataverseClient()
  const { selectedCompanyId } = useSelectedCompany()
  const { tier, prevId, nextId, goPrev, goNext, goBack } = useListNav('/sites', id)

  const query = useQuery({
    queryKey: ['site', id, tier ?? 'auto', selectedCompanyId ?? 'default'],
    queryFn: () => fetchSiteDetail(client, id!, tier),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const error = query.error instanceof Error ? query.error.message : null
  const fullAddress = record
    ? [record.line1, record.line2, record.city, record.stateorprovince, record.postalcode, record.country]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <div>
      <DetailNav label="Sites" prevId={prevId} nextId={nextId} onPrev={goPrev} onNext={goNext} onBack={goBack} />

      <DetailStates loading={query.isLoading} error={error}>
        {record && (
        <DetailHeader
          icon="mapPin"
          title={record.name || 'Site'}
          trailing={
            record.new_connectivitytype_label ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rc-blue-light px-2.5 py-0.5 text-xs font-medium text-rc-navy">
                <Icon name="activity" className="h-3 w-3" />
                {record.new_connectivitytype_label}
              </span>
            ) : undefined
          }
        >
          <MetaGrid>
            <MetaItem icon="mapPin" label="Address" value={fullAddress} />
            <MetaItem icon="building" label="City" value={record.city} />
            <MetaItem icon="tag" label="County" value={record.stateorprovince} />
            <MetaItem icon="hash" label="Postcode" value={record.postalcode} />
            <MetaItem icon="globe" label="Country" value={record.country} />
            <MetaItem icon="phone" label="Site phone" value={record.telephone1} />
            <MetaItem icon="activity" label="Connectivity" value={record.new_connectivitytype_label} />
            <MetaItem icon="mapPin" label="Type" value={record.addresstypecode_label && `${record.addresstypecode_label} address`} />
            <MetaItem icon="clock" label="Added" value={formatDate(record.createdon)} />
          </MetaGrid>
        </DetailHeader>
        )}
      </DetailStates>
    </div>
  )
}
