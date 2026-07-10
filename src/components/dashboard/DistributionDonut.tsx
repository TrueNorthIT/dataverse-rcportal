import { useNavigate } from 'react-router-dom'
import { Pie, PieChart, Cell, ResponsiveContainer } from 'recharts'
import type { IconName } from '../common/Icon'
import type { Pill } from '../../services/pills'
import { usePillCounts } from '../../hooks/usePillCounts'
import { CacheBadge } from '../debug/CacheBadge'
import { ChartCard, ChartEmpty, ChartSkeleton } from './ChartCard'
import { reducedMotion } from './palette'

interface Props {
  title: string
  icon: IconName
  /** SDK route/table (e.g. 'project', 'case', 'quote'). */
  table: string
  /** List route the segments deep-link into (e.g. '/projects'). */
  area: string
  pills: Pill[]
  /** Pill key → hex colour. */
  colors: Record<string, string>
  /** Only fetch once the card is in view (so it doesn't starve the tiles). */
  enabled?: boolean
}

/**
 * A donut of a table's distribution across its filter pills, counted at the
 * company tier via the same `usePillCounts` the list pages use — so the chart,
 * the pill, and the list always agree. Clicking a slice or a legend row
 * deep-links to `${area}?f=${pillKey}`.
 */
export function DistributionDonut({ title, icon, table, area, pills, colors, enabled = true }: Props) {
  const navigate = useNavigate()
  // fanOut → roll up across all companies when "All companies" is on; enabled
  // defers the fetch until the card is scrolled into view.
  const counts = usePillCounts(table, 'team', pills, { fanOut: true, enabled })
  const loaded = Object.keys(counts).length > 0

  const segments = pills
    .filter((p) => p.filter)
    .map((p) => ({ key: p.key, label: p.label, value: counts[p.key] ?? 0, color: colors[p.key] ?? '#94a3b8' }))
  const total = segments.reduce((s, x) => s + x.value, 0)
  const shown = segments.filter((s) => s.value > 0)
  const go = (key: string) => navigate(`${area}?f=${encodeURIComponent(key)}`)

  return (
    <ChartCard
      title={title}
      icon={icon}
      badge={
        // Pill counts are the filtered aggregates on this chart's table.
        <CacheBadge match={(u) => u.includes(`/aggregate/${table}`) && u.includes('filter=')} />
      }
    >
      {!loaded ? (
        <ChartSkeleton className="h-32 w-full" />
      ) : total === 0 ? (
        <ChartEmpty />
      ) : (
        <div className="flex w-full items-center gap-4">
          <div className="relative h-32 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shown}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={42}
                  outerRadius={60}
                  paddingAngle={shown.length > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive={!reducedMotion()}
                  onClick={(_: unknown, i: number) => {
                    const s = shown[i]
                    if (s) go(s.key)
                  }}
                >
                  {shown.map((s) => (
                    <Cell key={s.key} fill={s.color} className="cursor-pointer outline-none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-light tabular-nums text-rc-navy">{total}</span>
              <span className="text-[10px] uppercase tracking-wide text-rc-teal">total</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1">
            {segments.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => go(s.key)}
                  disabled={s.value === 0}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm transition-colors hover:bg-rc-blue-light/50 disabled:opacity-40"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate text-rc-navy">{s.label}</span>
                  <span className="ml-auto shrink-0 tabular-nums font-medium text-rc-teal">{s.value}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  )
}
