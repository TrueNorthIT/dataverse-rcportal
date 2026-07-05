import type { ReactNode } from 'react'
import { Card } from '../common/Card'
import { Icon, type IconName } from '../common/Icon'
import { useInView } from '../../hooks/useInView'

/** One box in the request-flow diagram. */
function Node({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-rc-blue-light bg-rc-canvas px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-rc-blue shadow-sm">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-rc-navy">{title}</div>
        <div className="text-xs text-rc-teal">{sub}</div>
      </div>
    </div>
  )
}

/** Flow connector: points right on desktop, down when the boxes stack on mobile. */
function Arrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-rc-teal">
      <Icon name="chevronRight" className="hidden h-5 w-5 sm:block" />
      <Icon name="chevronDown" className="h-5 w-5 sm:hidden" />
    </div>
  )
}

function Point({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0 text-rc-green" />
      <span>{children}</span>
    </div>
  )
}

/**
 * Bottom-of-dashboard explainer: how the portal is wired and secured. Copy is
 * kept plain and direct (no marketing framing). Doubles as a demo talking point.
 */
export function ArchitectureNote() {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={inView ? 'rc-unfold' : 'opacity-0'}>
      <Card className="overflow-hidden">
        <div className="rc-gradient h-1 w-full" />
        <div className="p-5 sm:p-6">
          <h2 className="text-base font-medium tracking-tight text-rc-navy">How this portal is built</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-rc-teal">
            Everything on this page is real Dataverse data. The React portal never talks to Dataverse
            directly. It goes through the TrueNorth Contact Portal API, a stateless proxy that
            authenticates every request with Entra External ID and enforces what each person is allowed
            to see.
          </p>

          {/* Request flow: browser → API → data store */}
          <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Node icon="globe" title="React portal" sub="browser app" />
            <Arrow />
            <Node icon="link" title="Contact Portal API" sub="Docker, stateless proxy" />
            <Arrow />
            <Node icon="server" title="Dataverse" sub="your data" />
          </div>
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rc-blue-light px-3 py-1 text-xs font-medium text-rc-navy">
              <Icon name="lock" className="h-3.5 w-3.5" />
              Secured end to end by Entra External ID
            </span>
          </div>

          <div className="mt-6 grid gap-2 text-sm text-rc-navy sm:grid-cols-2">
            <Point>Projects, sites and quotes are scoped to the signed-in contact or their company.</Point>
            <Point>Knowledge base articles are public, so no permission check runs.</Point>
            <Point>You can view every quote, site and project across your company.</Point>
            <Point>You can edit your own profile, but not a colleague&rsquo;s.</Point>
          </div>
          <p className="mt-4 text-xs text-rc-teal">
            We choose what to expose and how to secure it through configuration, not code.
          </p>
        </div>
      </Card>
    </div>
  )
}
