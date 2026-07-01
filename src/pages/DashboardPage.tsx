import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { useMyCompany } from '../hooks/useMyCompany'
import { formatCurrency } from '../lib/format'
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat to="/cases" label="Open tickets" value={loading ? '…' : fmtCount(stats.cases)} />
        <Stat to="/opportunities" label="Open opportunities" value={loading ? '…' : fmtCount(stats.opportunities)} />
        <Stat
          to="/opportunities"
          label="Pipeline value"
          value={loading ? '…' : stats.pipeline == null ? '—' : formatCurrency(stats.pipeline)}
        />
        <Stat to="/quotes" label="Quotes" value={loading ? '…' : fmtCount(stats.quotes)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Shortcut to="/cases" title="Raise a ticket" body="Log a new support case with our team." />
        <Shortcut to="/profile" title="My profile" body="View and edit your contact details." />
        <Shortcut to="/company" title="My company" body="Company details and your colleagues." />
      </div>
    </div>
  )
}

function Stat({ to, label, value }: { to: string; label: string; value: string }) {
  return (
    <Link to={to} className="block">
      <Card className="overflow-hidden transition-colors hover:border-rc-blue">
        <div className="rc-gradient h-1 w-full" />
        <div className="p-5">
          <div className="text-xs font-medium text-rc-teal">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-rc-navy">{value}</div>
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
