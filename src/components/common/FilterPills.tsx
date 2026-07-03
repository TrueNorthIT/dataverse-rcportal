/**
 * Tappable filter pills — a light, funky filter row that follows the RC style.
 * The active pill wears the signature blue→teal→green gradient; the rest are
 * clean outlined chips. Purely presentational: the parent owns the value and
 * maps the selected key to a query filter.
 */
export interface PillOption {
  key: string
  label: string
}

export function FilterPills({
  options,
  value,
  onChange,
  className = '',
}: {
  options: PillOption[]
  value: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Filter">
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
  )
}
