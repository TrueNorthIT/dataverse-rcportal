import type { Tier } from '../../hooks/useTierList'
import { SegmentedToggle } from './SegmentedToggle'

/**
 * "My / Company" segmented control (spec §2, §6). Drives the me/team tier on a
 * list view. Uses the shared SegmentedToggle so it reads identically to the
 * dashboard's "This company / All companies" scope toggle.
 */
export function TierToggle({ tier, onChange }: { tier: Tier; onChange: (tier: Tier) => void }) {
  return (
    <SegmentedToggle<Tier>
      value={tier}
      onChange={onChange}
      ariaLabel="Record scope"
      options={[
        { key: 'me', label: 'My' },
        { key: 'team', label: 'Company' },
      ]}
    />
  )
}
