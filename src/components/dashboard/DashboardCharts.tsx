import type { CSSProperties, ReactNode } from 'react'
import { buildProjectPills } from '../../services/projectApi'
import { CASE_PILLS } from '../../services/caseApi'
import { QUOTE_PILLS } from '../../services/quoteApi'
import { useInView } from '../../hooks/useInView'
import { DistributionDonut } from './DistributionDonut'
import { ConnectivityBars } from './ConnectivityBars'
import { DeliveryTrend } from './DeliveryTrend'
import { HEALTH_COLORS, PRIORITY_COLORS, QUOTE_COLORS } from './palette'

/**
 * Wraps a chart so it unfolds when scrolled into view (staggered by index) and
 * only fetches once visible. The render-prop hands `inView` to the child so it
 * can gate its query — that way an all-companies roll-up doesn't fire every
 * chart's fan-out at once and starve the visible tiles of connections.
 */
function Reveal({ index, children }: { index: number; children: (inView: boolean) => ReactNode }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={inView ? 'rc-unfold h-full' : 'h-full opacity-0'}
      style={{ '--rc-delay': `${index * 90}ms` } as CSSProperties}
    >
      {children(inView)}
    </div>
  )
}

/**
 * The dashboard "At a glance" section — four distribution charts + the delivery
 * trend, all real Dataverse aggregates. Lazy-loaded (recharts is heavy) and
 * revealed on scroll. Default export so DashboardPage can React.lazy() it.
 */
export default function DashboardCharts() {
  return (
    <section id="insights" className="mt-8 scroll-mt-6">
      <h2 className="mb-3 text-base font-normal tracking-tight text-white">At a glance</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Reveal index={0}>
          {(inView) => (
            <DistributionDonut
              title="Projects by health"
              icon="layers"
              table="project"
              area="/projects"
              pills={buildProjectPills()}
              colors={HEALTH_COLORS}
              enabled={inView}
            />
          )}
        </Reveal>
        <Reveal index={1}>
          {(inView) => (
            <DistributionDonut
              title="Cases by priority"
              icon="flag"
              table="case"
              area="/cases"
              pills={CASE_PILLS}
              colors={PRIORITY_COLORS}
              enabled={inView}
            />
          )}
        </Reveal>
        <Reveal index={2}>
          {(inView) => (
            <DistributionDonut
              title="Quotes by state"
              icon="receipt"
              table="quote"
              area="/quotes"
              pills={QUOTE_PILLS}
              colors={QUOTE_COLORS}
              enabled={inView}
            />
          )}
        </Reveal>
        <Reveal index={3}>{(inView) => <ConnectivityBars enabled={inView} />}</Reveal>
      </div>
      <Reveal index={4}>
        {(inView) => (
          <div className="mt-4">
            <DeliveryTrend enabled={inView} />
          </div>
        )}
      </Reveal>
    </section>
  )
}
