/**
 * Compact sort dropdown for list views. A styled native <select> — accessible,
 * keyboard-friendly, and quiet enough to sit beside the filter pills.
 */
export interface SortOption {
  key: string
  label: string
}

export function SortMenu({
  options,
  value,
  onChange,
}: {
  options: SortOption[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <label className="inline-flex shrink-0 items-center gap-2 text-sm text-rc-teal">
      <span className="hidden sm:inline">Sort</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-lg border border-rc-blue-light bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-rc-navy transition-colors hover:border-rc-blue focus:border-rc-blue focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-rc-teal"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </label>
  )
}
