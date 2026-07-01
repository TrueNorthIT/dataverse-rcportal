import { useMyCompany } from '../hooks/useMyCompany'
import { useTierList } from '../hooks/useTierList'
import { COLLEAGUE_SELECT } from '../services/accountApi'
import type { Contact } from '../types/contact'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { ListStates, LoadMore } from '../components/common/ListStates'

/**
 * "My company" — the customer's account details plus a directory of colleagues
 * (contacts on the same account, always the `team` tier).
 */
export function CompanyPage() {
  const { account, loading: accountLoading, error: accountError } = useMyCompany()
  const {
    items: colleagues,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
  } = useTierList<Contact>(
    'contact',
    { select: COLLEAGUE_SELECT, orderBy: { field: 'fullname', direction: 'asc' }, top: 25 },
    'team',
  )

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="My company" subtitle={account?.name} />
        <Card className="overflow-hidden">
          <div className="rc-gradient h-1 w-full" />
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            {accountLoading && <p className="text-sm text-rc-teal">Loading…</p>}
            {accountError && <p className="text-sm text-red-600">{accountError}</p>}
            {account && (
              <>
                <Detail label="Company name" value={account.name} />
                <Detail label="Phone" value={account.telephone1} />
                <Detail
                  label="Website"
                  value={account.websiteurl}
                  href={account.websiteurl}
                />
                <Detail label="Email" value={account.emailaddress1} />
                <Detail
                  label="Address"
                  value={[
                    account.address1_line1,
                    account.address1_city,
                    account.address1_postalcode,
                    account.address1_country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                />
              </>
            )}
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-rc-navy">Colleagues</h2>
        <ListStates
          loading={loading}
          error={error}
          isEmpty={colleagues.length === 0}
          emptyMessage="No colleagues found for your company."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {colleagues.map((c) => (
              <Card key={c.contactid} className="p-4">
                <div className="font-medium text-rc-navy">{c.fullname || '—'}</div>
                {c.jobtitle && (
                  <div className="text-sm text-rc-teal">{c.jobtitle}</div>
                )}
                {c.emailaddress1 && (
                  <div className="mt-1 text-sm text-rc-blue">{c.emailaddress1}</div>
                )}
                {(c.telephone1 || c.mobilephone) && (
                  <div className="text-xs text-rc-teal">
                    {[c.telephone1, c.mobilephone].filter(Boolean).join(' · ')}
                  </div>
                )}
              </Card>
            ))}
          </div>
          <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />
        </ListStates>
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
  href,
}: {
  label: string
  value?: string | null
  href?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-rc-teal">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-rc-blue hover:underline"
        >
          {value || '—'}
        </a>
      ) : (
        <span className="text-sm text-rc-navy">{value || '—'}</span>
      )}
    </div>
  )
}
