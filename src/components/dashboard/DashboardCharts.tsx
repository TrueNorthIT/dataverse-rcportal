import type { CSSProperties, ReactNode } from 'react'
import { buildProjectPills } from '../../services/projectApi'
import { CASE_PILLS } from '../../services/caseApi'
import { QUOTE_PILLS } from '../../services/quoteApi'
import { useInView } from '../../hooks/useInView'
import { DistributionDonut } from './DistributionDonut'
import { ConnectivityBars } from './ConnectivityBars'
import { DeliveryTrend } from './DeliveryTrend'
import { HEALTH_COLORS, PRIORITY_COLORS, QUOTE_COLORS } from './palette'

/** Wraps a chart so it unfolds when scrolled into view, staggered by index. */
function Reveal({ index, children }: { index: number; children: ReactNode }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={inView ? 'rc-unfold h-full' : 'h-full opacity-0'}
      style={{ '--rc-delay': `${index * 90}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

/**
 * The dashboard "At a glance" section — four distribution charts + the delivery
 * trend, all real Dataverse aggregates. Lazy-loaded (recharts is heavy) and
 * unfolded on scroll. Default export so DashboardPage can React.lazy() it, and
 * re-keyed by scope there so it re-unfolds on a company-scope switch.
 */
export default function DashboardCharts() {
  return (
    <section id="insights" className="mt-8 scroll-mt-6">
      <h2 className="mb-3 text-base font-normal tracking-tight text-white">At a glance</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Reveal index={0}>
          <DistributionDonut
            title="Projects by health"
            icon="layers"
            table="project"
            area="/projects"
            pills={buildProjectPills()}
            colors={HEALTH_COLORS}
          />
        </Reveal>
        <Reveal index={1}>
          <DistributionDonut
            title="Cases by priority"
            icon="flag"
            table="case"
            area="/cases"
            pills={CASE_PILLS}
            colors={PRIORITY_COLORS}
          />
        </Reveal>
        <Reveal index={2}>
          <DistributionDonut
            title="Quotes by state"
            icon="receipt"
            table="quote"
            area="/quotes"
            pills={QUOTE_PILLS}
            colors={QUOTE_COLORS}
          />
        </Reveal>
        <Reveal index={3}>
          <ConnectivityBars />
        </Reveal>
      </div>
      <Reveal index={4}>
        <div className="mt-4">
          <DeliveryTrend />
        </div>
      </Reveal>
    </section>
  )
}
