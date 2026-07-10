import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDeliveryTrend } from '../../hooks/useDeliveryTrend'
import { CacheBadge } from '../debug/CacheBadge'
import { ChartCard, ChartEmpty, ChartSkeleton } from './ChartCard'
import { reducedMotion } from './palette'

/** Minimal branded tooltip for the trend. */
function TrendTip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  const point = payload.find((p) => typeof p.value === 'number')
  if (!point) return null
  const delivered = point.dataKey === 'delivered'
  return (
    <div className="rounded-lg border border-rc-blue-light bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-rc-navy">{label}</div>
      <div className="text-rc-teal">
        {point.value} {delivered ? 'delivered' : 'projected'}
      </div>
    </div>
  )
}

/**
 * Cumulative "Deliveries by month" — a solid gradient area of real deliveries
 * up to today, continuing as a dashed line for the upcoming pipeline. All from
 * real project dates (see useDeliveryTrend).
 */
export function DeliveryTrend({ enabled = true }: { enabled?: boolean }) {
  const { data, loading } = useDeliveryTrend(enabled)
  const hasData = data.some((d) => (d.delivered ?? d.projected ?? 0) > 0)

  return (
    <ChartCard
      title="Deliveries by month"
      icon="activity"
      badge={
        // The trend reads the project list (finish/actual-end dates), not an aggregate.
        <CacheBadge match={(u) => u.includes('/team/project') && u.includes('msdyn_finish')} />
      }
    >
      {loading ? (
        <ChartSkeleton className="h-48 w-full" />
      ) : !hasData ? (
        <ChartEmpty message="No delivery history yet." />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="rcDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e8aa0" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1c6b4f" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#005862' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#005862' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip content={<TrendTip />} />
            <Area
              type="monotone"
              dataKey="delivered"
              stroke="#0a5ca8"
              strokeWidth={2.5}
              fill="url(#rcDelivered)"
              connectNulls
              isAnimationActive={!reducedMotion()}
            />
            <Area
              type="monotone"
              dataKey="projected"
              stroke="#1c6b4f"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="none"
              connectNulls
              isAnimationActive={!reducedMotion()}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
