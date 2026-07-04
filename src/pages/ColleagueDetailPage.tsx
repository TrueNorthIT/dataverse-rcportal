import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { fetchColleague, listColleagueCases } from '../services/contactApi'
import { formatDate } from '../lib/format'
import { Card } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'
import { Icon } from '../components/common/Icon'
import {
  DetailHeader,
  DetailNav,
  DetailSkeleton,
  MetaGrid,
  MetaItem,
  SectionTitle,
} from '../components/detail/DetailChrome'

/** Read-only colleague detail: profile, contact details, and their recent cases. */
export function ColleagueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const client = useDataverseClient()
  const { selectedContactId } = useSelectedCompany()
  const { prevId, nextId, goPrev, goNext, goBack } = useListNav('/company', id)

  const query = useQuery({
    queryKey: ['colleague', id, selectedContactId ?? 'default'],
    queryFn: () => fetchColleague(client, id!),
    enabled: !!id,
  })
  const c = query.data ?? null
  const error = query.error instanceof Error ? query.error.message : null

  const casesQuery = useQuery({
    queryKey: ['colleague-cases', id, selectedContactId ?? 'default'],
    queryFn: () => listColleagueCases(client, id!),
    enabled: !!id && !!c,
  })
  const cases = casesQuery.data ?? []

  const address = c
    ? [c.address1_line1, c.address1_city, c.address1_postalcode, c.address1_country].filter(Boolean).join(', ')
    : ''

  return (
    <div>
      <DetailNav label="My company" prevId={prevId} nextId={nextId} onPrev={goPrev} onNext={goNext} onBack={goBack} />

      {query.isLoading && <DetailSkeleton />}
      {error && <p className="text-sm text-red-200">{error}</p>}

      {c && (
        <DetailHeader
          icon="user"
          title={c.fullname || 'Colleague'}
          trailing={
            c.donotbulkemail ? (
              <span
                title="Opted out of marketing email"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
              >
                <Icon name="mail" className="h-3 w-3" /> No marketing
              </span>
            ) : undefined
          }
        >
          <MetaGrid>
            <MetaItem icon="briefcase" label="Job title" value={c.jobtitle} />
            <MetaItem icon="users" label="Department" value={c.department} />
            <MetaItem icon="mail" label="Email" value={c.emailaddress1} />
            <MetaItem icon="phone" label="Phone" value={c.telephone1} />
            <MetaItem icon="phone" label="Mobile" value={c.mobilephone} />
            <MetaItem icon="mapPin" label="Address" value={address} />
          </MetaGrid>
        </DetailHeader>
      )}

      {c && (
        <div className="mt-6">
          <SectionTitle icon="fileText" count={cases.length}>Recent cases</SectionTitle>
          {casesQuery.isLoading ? (
            <Card className="p-5"><p className="text-sm text-rc-teal">Loading cases…</p></Card>
          ) : cases.length === 0 ? (
            <Card className="p-5"><p className="text-sm text-rc-teal">No support cases raised by this colleague.</p></Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-rc-blue-light">
                {cases.map((k) => (
                  <div key={k.incidentid} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-rc-navy">{k.title || 'Untitled'}</div>
                      <div className="text-xs text-rc-teal">
                        {k.ticketnumber ? `${k.ticketnumber} · ` : ''}Raised {formatDate(k.createdon)}
                      </div>
                    </div>
                    <StatusChip label={k.statuscode_label} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
