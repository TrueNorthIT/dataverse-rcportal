/**
 * Sort control rendered as pills — same look as the filter pills (active pill
 * wears the brand gradient), so the two controls feel of a piece. A light
 * "Sort" label distinguishes it from the filter row on the gradient background.
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-white/70">Sort</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sort by">
        {options.map((o) => {
          const active = o.key === value
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.key)}
              className={
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95 ' +
                (active
                  ? 'rc-gradient text-white shadow-sm'
                  : 'border border-rc-blue-light bg-white text-rc-teal hover:border-rc-blue hover:text-rc-navy')
              }
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
