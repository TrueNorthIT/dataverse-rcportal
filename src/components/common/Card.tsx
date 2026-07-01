/** White surface with the brand border + soft shadow, used across screens. */
export function Card({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border border-rc-blue-light bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

/** Card variant that renders as a link/button row for list items. */
export function CardButton({
  onClick,
  className = '',
  children,
}: {
  onClick?: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border border-rc-blue-light bg-white p-4 text-left shadow-sm transition-colors hover:border-rc-blue hover:bg-rc-blue-light/40 ${className}`}
    >
      {children}
    </button>
  )
}
