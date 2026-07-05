import { useState } from 'react'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { SegmentedToggle } from '../common/SegmentedToggle'

type Scope = 'one' | 'all'

/**
 * Dashboard-only scope switch: show the selected company, or roll up the tiles
 * and charts across all of the caller's companies. Hidden for single-company
 * users. Same shared control as the list "My / Company" toggle so they match.
 * Deliberately separate from the header company dropdown — the dropdown picks
 * which company lists/detail act as; this only changes the dashboard roll-up.
 */
export function CompanyScopeToggle() {
  const { hasMultiple } = useSelectedCompany()
  // DIAGNOSTIC: visual-only state — the filter/data trigger is disconnected so
  // we can test whether the button itself keeps up with fast taps, independent
  // of the roll-up loading. (Not for merge — this does not change scope.)
  const [scope, setScope] = useState<Scope>('one')
  if (!hasMultiple) return null
  return (
    <SegmentedToggle<Scope>
      value={scope}
      onChange={setScope}
      ariaLabel="Dashboard scope"
      className="shadow-sm"
      options={[
        { key: 'one', label: 'This company' },
        { key: 'all', label: 'All companies' },
      ]}
    />
  )
}
