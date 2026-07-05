import { lazy, Suspense, useEffect, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { useAttention } from '../hooks/useAttention'
import { useMyCompany } from '../hooks/useMyCompany'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { Icon } from '../components/common/Icon'
import { ArchitectureNote } from '../components/dashboard/ArchitectureNote'
import { CompanyScopeToggle } from '../components/dashboard/CompanyScopeToggle'

// recharts is heavy — split the whole charts section into its own lazy chunk.
const DashboardCharts = lazy(() => import('../components/dashboard/DashboardCharts'))

// Query-key roots for everything the dashboard renders — used to show the
// "updating" indicator while any of them (re)fetch, e.g. after a scope switch.
const DASH_KEYS = new Set(['dashboard', 'attention', 'pillcounts', 'delivery-trend'])

/** Landing dashboard: headline `me`-tier stats with links into each section. */
export function DashboardPage() {
  const { stats, loading } = useDashboard()
  const { account } = useMyCompany()
  const { allCompanies, hasMultiple } = useSelectedCompany()
  // Any dashboard query in flight → the roll-up is (re)loading. Tapping the
  // toggle again just switches the scope; React Query tracks the latest, so the
  // last tap always wins.
  const syncing = useIsFetching({ predicate: (q) => DASH_KEYS.has(String(q.queryKey[0])) }) > 0

  const fmtCount = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-GB'))

  return (
    <div>
      {/* The scope toggle stays pinned to the top as you scroll (the app
          header/nav hides on scroll-down and slides back over this on
          scroll-up, hence the lower z-index). */}
      {hasMultiple && (
        <div className="sticky top-2 z-30 mb-3 flex items-center gap-3">
          <CompanyScopeToggle />
          <SyncIndicator active={syncing} />
        </div>
      )}
      <PageHeader
        title="Dashboard"
        subtitle={
          allCompanies
            ? 'Across all your companies'
            : account?.name
              ? `Welcome — ${account.name}`
              : 'Welcome'
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat to="/cases" label="Open tickets" value={fmtCount(stats.cases)} loading={loading} />
        <Stat to="/quotes" label="Quotes" value={fmtCount(stats.quotes)} loading={loading} />
        <Stat to="/projects" label="Projects" value={fmtCount(stats.projects)} loading={loading} />
        <Stat to="/sites" label="Sites" value={fmtCount(stats.sites)} loading={loading} />
      </div>

      <Attention />

      <ScrollHint />

      <Suspense
        fallback={<div className="rc-skeleton mt-8 h-64 w-full rounded-2xl" aria-label="Loading insights" />}
      >
        <DashboardCharts />
      </Suspense>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Shortcut to="/cases" title="Raise a ticket" body="Log a new support case with our team." />
        <Shortcut to="/profile" title="My profile" body="View and edit your contact details." />
        <Shortcut to="/company" title="My company" body="Company details and your colleagues." />
      </div>

      <div className="mt-8">
        <ArchitectureNote />
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

/** "Needs your attention" — a few actionable highlights, or an all-clear. */
function Attention() {
  const { items, loading } = useAttention()
  const dot: Record<string, string> = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-rc-blue',
  }

  return (
    <Card className="mt-8 overflow-hidden">
      <div className="rc-gradient h-1 w-full" />
      <div className="p-5">
        <h2 className="text-base font-normal tracking-tight text-rc-navy">
          Needs your attention
        </h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-rc-teal">
            {loading ? 'Checking…' : 'You’re all caught up — nothing needs attention.'}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((it) => (
              <Link
                key={it.key}
                to={it.to}
                className="flex items-center gap-3 rounded-xl border border-rc-blue-light bg-white p-3 transition-colors hover:border-rc-blue hover:bg-rc-blue-light/30"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot[it.tone]}`} />
                <span className="text-sm text-rc-navy">{it.label}</span>
                <svg
                  className="ml-auto shrink-0 text-rc-teal"
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

/** Funky "updating" chip shown beside the scope toggle while the dashboard
 * (re)loads — e.g. the all-companies roll-up fanning out. Three brand-coloured
 * equalizer bars; fades in/out so tapping the toggle stays responsive. */
function SyncIndicator({ active }: { active: boolean }) {
  const bars = ['#0a5ca8', '#0e8aa0', '#1c6b4f']
  return (
    <span
      role="status"
      aria-live="polite"
      className={
        'inline-flex items-center gap-2 rounded-lg border border-rc-blue-light bg-white px-2.5 py-1.5 shadow-sm transition-opacity duration-200 ' +
        (active ? 'opacity-100' : 'pointer-events-none opacity-0')
      }
    >
      <span className="flex h-3.5 items-end gap-0.5" aria-hidden="true">
        {bars.map((c, i) => (
          <span
            key={c}
            className="rc-bar w-1 rounded-full"
            style={{ height: '100%', backgroundColor: c, animationDelay: `${i * 0.14}s` }}
          />
        ))}
      </span>
      <span className="hidden text-xs font-medium text-rc-teal sm:inline">
        {active ? 'Updating…' : 'Up to date'}
      </span>
    </span>
  )
}

/** A bouncing down-arrow after the fold, hinting at the charts below. Scrolls
 * to them on click and fades out once the user starts scrolling down. */
function ScrollHint() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY < 140)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  // Scroll so the "At a glance" heading sits just below the (sticky) header,
  // rather than under it — offset by the header's real height so it never
  // overshoots. scrollIntoView + a fixed scroll-margin couldn't know the height.
  const toCharts = () => {
    const el = document.getElementById('insights')
    if (!el) return
    const headerH = document.querySelector('header')?.offsetHeight ?? 0
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - 12
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }
  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={toCharts}
        className="group flex flex-col items-center gap-1"
        aria-label="Scroll to insights"
      >
        {/* On the blue rc-hero page background, so use light text + a white chip
            with a blue chevron for contrast. */}
        <span className="text-xs font-medium text-white/90 transition-colors group-hover:text-white">
          More insights
        </span>
        <span className="rc-bounce flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white text-rc-blue shadow-sm transition-colors group-hover:border-white">
          <Icon name="chevronDown" className="h-4 w-4" />
        </span>
      </button>
    </div>
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
