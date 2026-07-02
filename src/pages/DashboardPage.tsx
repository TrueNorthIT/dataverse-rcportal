import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { useMyCompany } from '../hooks/useMyCompany'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'

/** Landing dashboard: headline `me`-tier stats with links into each section. */
export function DashboardPage() {
  const { stats, loading } = useDashboard()
  const { account } = useMyCompany()

  const fmtCount = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-GB'))

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={account?.name ? `Welcome — ${account.name}` : 'Welcome'}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat to="/cases" label="Open tickets" value={fmtCount(stats.cases)} loading={loading} />
        <Stat to="/quotes" label="Quotes" value={fmtCount(stats.quotes)} loading={loading} />
        <Stat to="/projects" label="Projects" value={fmtCount(stats.projects)} loading={loading} />
        <Stat to="/sites" label="Sites" value={fmtCount(stats.sites)} loading={loading} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Shortcut to="/cases" title="Raise a ticket" body="Log a new support case with our team." />
        <Shortcut to="/profile" title="My profile" body="View and edit your contact details." />
        <Shortcut to="/company" title="My company" body="Company details and your colleagues." />
      </div>
    </div>
  )
}

function Stat({
  to,
  label,
  value,
  loading,
}: {
  to: string
  label: string
  value: string
  loading?: boolean
}) {
  // Skeleton only on first load (no value yet); on a refetch (company switch)
  // keep the previous number and just dim it — no flash.
  const firstLoad = loading && value === '—'
  return (
    <Link to={to} className="block">
      <Card className="overflow-hidden transition-colors hover:border-rc-blue">
        <div className="rc-gradient h-1 w-full" />
        <div className="p-5">
          <div className="text-xs font-medium text-rc-teal">{label}</div>
          {firstLoad ? (
            <div className="rc-skeleton mt-2 h-7 w-16 rounded" aria-label="Loading" />
          ) : (
            <div
              className={
                'mt-1 text-3xl font-light tracking-tight text-rc-navy transition-opacity duration-200 ' +
                (loading ? 'opacity-50' : 'opacity-100')
              }
            >
              {value}
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}

function Shortcut({ to, title, body }: { to: string; title: string; body: string }) {
  return (
    <Link to={to} className="block">
      <Card className="p-5 transition-colors hover:border-rc-blue">
        <div className="font-medium text-rc-navy">{title}</div>
        <p className="mt-1 text-sm text-rc-teal">{body}</p>
      </Card>
    </Link>
  )
}
