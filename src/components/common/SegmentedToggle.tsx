import type { ReactNode } from 'react'

export interface SegOption<T extends string> {
  key: T
  label: ReactNode
}

/**
 * Shared segmented control (pill toggle) — one active segment in brand blue,
 * the rest quiet teal. Used by the list "My / Company" tier toggle and the
 * dashboard "This company / All companies" scope toggle so they read identically.
 */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: {
  value: T
  onChange: (key: T) => void
  options: SegOption<T>[]
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={'inline-flex rounded-lg border border-rc-blue-light bg-white p-0.5 text-sm ' + className}
    >
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={
              'whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ' +
              (active ? 'bg-rc-blue text-white' : 'text-rc-teal hover:bg-rc-blue-light')
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
