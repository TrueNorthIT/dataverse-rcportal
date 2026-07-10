import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { buildSitePills } from '../../services/siteApi'
import { usePillCounts } from '../../hooks/usePillCounts'
import { CacheBadge } from '../debug/CacheBadge'
import { ChartCard, ChartEmpty, ChartSkeleton } from './ChartCard'
import { CONNECTIVITY_COLORS, reducedMotion } from './palette'

/**
 * Horizontal bars of sites by connectivity type (reads better than a 5-slice
 * donut). Counts come from `usePillCounts('site', …)` using the same site pills
 * as the Sites page; a bar click deep-links to `/sites?f=<type>`.
 */
export function ConnectivityBars({ enabled = true }: { enabled?: boolean }) {
  const navigate = useNavigate()
  const pills = buildSitePills()
  const counts = usePillCounts('site', 'team', pills, { fanOut: true, enabled })
  const loaded = Object.keys(counts).length > 0

  const data = pills
    .filter((p) => p.filter)
    .map((p, i) => ({
      key: p.key,
      label: p.label,
      value: counts[p.key] ?? 0,
      color: CONNECTIVITY_COLORS[i % CONNECTIVITY_COLORS.length],
    }))
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard
      title="Sites by connectivity"
      icon="mapPin"
      badge={<CacheBadge match={(u) => u.includes('/aggregate/site') && u.includes('filter=')} />}
    >
      {!loaded ? (
        <ChartSkeleton className="h-40 w-full" />
      ) : total === 0 ? (
        <ChartEmpty />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(150, data.length * 30)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 0 }} barCategoryGap={6}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="label"
              width={78}
              tick={{ fontSize: 12, fill: '#005862' }}
              axisLine={false}
              tickLine={false}
            />
            <Bar
              dataKey="value"
              radius={[0, 6, 6, 0]}
              isAnimationActive={!reducedMotion()}
              onClick={(d: unknown) => {
                const key = (d as { key?: string }).key
                if (key) navigate(`/sites?f=${encodeURIComponent(key)}`)
              }}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} className="cursor-pointer" />
              ))}
              <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#142d46' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
