import { useEffect, useRef, useState } from 'react'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { SegmentedToggle } from '../common/SegmentedToggle'

type Scope = 'one' | 'all'

/**
 * Dashboard-only scope switch: show the selected company, or roll up the tiles
 * and charts across all of the caller's companies. Hidden for single-company
 * users. Same shared control as the list "My / Company" toggle so they match.
 * Deliberately separate from the header company dropdown.
 *
 * The highlight is driven by local state so a tap flips it instantly and never
 * misses — even rapid taps. The expensive part (committing the scope, which
 * fans out the roll-up) is debounced, so fast tapping doesn't kick off a load
 * on every intermediate state and jank the main thread; only where you settle
 * actually loads.
 */
export function CompanyScopeToggle() {
  const { hasMultiple, allCompanies, selectAllCompanies, selectCompany, selectedContactId } =
    useSelectedCompany()
  const contextScope: Scope = allCompanies ? 'all' : 'one'
  const [scope, setScope] = useState<Scope>(contextScope)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Keep the highlight in sync when the scope changes elsewhere (e.g. picking a
  // company from the header dropdown clears all-companies).
  useEffect(() => setScope(contextScope), [contextScope])
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!hasMultiple) return null

  const onChange = (next: Scope) => {
    setScope(next) // instant highlight
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (next === 'all') selectAllCompanies()
      else selectCompany(selectedContactId)
    }, 180) // commit (and load) once taps settle
  }

  return (
    <SegmentedToggle<Scope>
      value={scope}
      onChange={onChange}
      ariaLabel="Dashboard scope"
      className="shadow-sm"
      options={[
        { key: 'one', label: 'This company' },
        { key: 'all', label: 'All companies' },
      ]}
    />
  )
}
