import { ChartCard, ChartSkeleton } from './ChartCard'
import type { IconName } from '../common/Icon'

// Matched to <DashboardCharts>: same titles, icons and skeleton-body heights, so
// the two render at identical size.
const DONUTS: { title: string; icon: IconName; body: string }[] = [
  { title: 'Projects by health', icon: 'layers', body: 'h-32' },
  { title: 'Cases by priority', icon: 'flag', body: 'h-32' },
  { title: 'Quotes by state', icon: 'receipt', body: 'h-32' },
  { title: 'Sites by connectivity', icon: 'mapPin', body: 'h-40' },
]

/**
 * Layout-matched placeholder for the lazy-loaded <DashboardCharts>. It mirrors
 * that section exactly — the "At a glance" heading, a 2-col grid of four chart
 * cards, and the delivery-trend card, all at the same heights — so when the
 * charts chunk swaps in, nothing below it shifts. (Before this, the short
 * fallback let the taller charts shove the shortcuts + notes down: the
 * dashboard's biggest layout shift.) Light on purpose — no recharts.
 */
export function DashboardChartsSkeleton() {
  return (
    <section className="mt-8" aria-hidden="true">
      <h2 className="mb-3 text-base font-normal tracking-tight text-white">At a glance</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DONUTS.map((c) => (
          <ChartCard key={c.title} title={c.title} icon={c.icon}>
            <ChartSkeleton className={`${c.body} w-full`} />
          </ChartCard>
        ))}
      </div>
      <div className="mt-4">
        <ChartCard title="Deliveries by month" icon="activity">
          <ChartSkeleton className="h-48 w-full" />
        </ChartCard>
      </div>
    </section>
  )
}
