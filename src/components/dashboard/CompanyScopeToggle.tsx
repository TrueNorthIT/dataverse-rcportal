import type { ReactNode } from 'react'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'

/**
 * Dashboard-only scope switch: show the selected company, or roll up the tiles
 * and charts across all of the caller's companies. Hidden for single-company
 * users. Deliberately separate from the header company dropdown — the dropdown
 * picks which company lists/detail act as; this only changes the dashboard
 * roll-up (aggregates fan out per company and sum).
 */
export function CompanyScopeToggle() {
  const { hasMultiple, allCompanies, selectAllCompanies, selectCompany, selectedContactId } =
    useSelectedCompany()
  if (!hasMultiple) return null
  return (
    <div
      role="tablist"
      aria-label="Dashboard scope"
      className="inline-flex rounded-lg border border-rc-blue-light bg-white p-0.5 text-sm"
    >
      <Segment active={!allCompanies} onClick={() => allCompanies && selectCompany(selectedContactId)}>
        This company
      </Segment>
      <Segment active={allCompanies} onClick={() => !allCompanies && selectAllCompanies()}>
        All companies
      </Segment>
    </div>
  )
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ' +
        (active ? 'bg-rc-blue text-white' : 'text-rc-teal hover:bg-rc-blue-light')
      }
    >
      {children}
    </button>
  )
}
