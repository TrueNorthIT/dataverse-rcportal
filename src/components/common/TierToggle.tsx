import type { Tier } from '../../hooks/useTierList'

/**
 * First-class "My / Company" segmented control (spec §2, §6). Drives the
 * me/team tier on a list view. Brand blue for the active segment.
 */
export function TierToggle({
  tier,
  onChange,
}: {
  tier: Tier
  onChange: (tier: Tier) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Record scope"
      className="inline-flex rounded-lg border border-rc-blue-light bg-white p-0.5 text-sm"
    >
      <Segment active={tier === 'me'} onClick={() => onChange('me')}>
        My
      </Segment>
      <Segment active={tier === 'team'} onClick={() => onChange('team')}>
        Company
      </Segment>
    </div>
  )
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'rounded-md px-3 py-1.5 font-medium transition-colors ' +
        (active
          ? 'bg-rc-blue text-white'
          : 'text-rc-teal hover:bg-rc-blue-light')
      }
    >
      {children}
    </button>
  )
}
