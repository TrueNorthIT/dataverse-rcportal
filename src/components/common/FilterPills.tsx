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
  disabledKeys,
  className = '',
}: {
  options: PillOption[]
  value: string
  onChange: (key: string) => void
  /** Keys to render greyed-out and non-interactive (e.g. filters with no rows). */
  disabledKeys?: Set<string>
  className?: string
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Filter">
      {options.map((o) => {
        const active = o.key === value
        const disabled = !active && disabledKeys?.has(o.key)
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            title={disabled ? 'None to show' : undefined}
            onClick={() => onChange(o.key)}
            className={
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ' +
              (active
                ? 'rc-gradient text-white shadow-sm active:scale-95'
                : disabled
                  ? 'cursor-not-allowed border border-rc-blue-light/60 bg-white text-rc-teal/40'
                  : 'border border-rc-blue-light bg-white text-rc-teal hover:border-rc-blue hover:text-rc-navy active:scale-95')
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
