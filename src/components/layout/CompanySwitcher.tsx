import { useSelectedCompany } from '../../context/SelectedCompanyContext'

/**
 * Company switcher for users who are a contact under more than one company.
 *
 * Renders nothing for the common single-company case. When the caller has
 * several, it shows a dropdown of their companies; picking one updates the
 * selected contact id, which flows into `useDataverseClient()` as the
 * `X-Contact-Id` header so every subsequent request acts as that company.
 *
 * Styled to match the brand: a compact pill with the blue→teal gradient hairline
 * echoing the header accent.
 */
export function CompanySwitcher() {
  const { companies, hasMultiple, currentCompany, selectCompany } = useSelectedCompany()

  if (!hasMultiple) return null

  return (
    <label className="hidden items-center gap-2 sm:flex">
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-rc-teal">
        Viewing as
      </span>
      <div className="rc-gradient rounded-lg p-px shadow-sm">
        <select
          aria-label="Switch company"
          value={currentCompany?.contactid ?? ''}
          onChange={(e) => selectCompany(e.target.value || undefined)}
          className="cursor-pointer rounded-[7px] bg-white px-3 py-1.5 text-sm font-semibold text-rc-navy focus:outline-none focus:ring-2 focus:ring-rc-blue/30"
        >
          {companies.map((c) => (
            <option key={c.contactid} value={c.contactid}>
              {c.companyName ?? c.fullname ?? 'Unnamed company'}
            </option>
          ))}
        </select>
      </div>
    </label>
  )
}
