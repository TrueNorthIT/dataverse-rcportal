import type { ReactNode } from 'react'
import { Card } from '../common/Card'
import { Icon, type IconName } from '../common/Icon'

/** Shared shell for a dashboard chart: brand card + gradient strip + funky
 * titled header with an icon chip. Children render the chart body. */
export function ChartCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: IconName
  children: ReactNode
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="rc-gradient h-1 w-full" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rc-blue-light text-rc-blue">
            <Icon name={icon} className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-medium tracking-tight text-rc-navy">{title}</h3>
        </div>
        <div className="flex flex-1 items-center">{children}</div>
      </div>
    </Card>
  )
}

/** A soft skeleton block, sized by the caller, while a chart's counts load. */
export function ChartSkeleton({ className = 'h-32 w-full' }: { className?: string }) {
  return <div className={`rc-skeleton rounded-xl ${className}`} aria-label="Loading" />
}

/** Empty state when a chart has no data for the selected company. */
export function ChartEmpty({ message = 'Nothing to chart yet.' }: { message?: string }) {
  return <p className="w-full text-center text-sm text-rc-teal">{message}</p>
}
