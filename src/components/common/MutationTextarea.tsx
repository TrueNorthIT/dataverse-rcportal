/**
 * A textarea + submit button with the shared save/post states: a pending label
 * swap, a disabled-until-valid button, and inline error/success messages. The
 * single-field write widget behind "edit description" and "post an update" —
 * point it at a mutation, no boilerplate per screen.
 */
export function MutationTextarea({
  value,
  onChange,
  onSubmit,
  submitLabel,
  pendingLabel,
  pending,
  disabled = false,
  rows = 4,
  placeholder,
  error = null,
  success = null,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  submitLabel: string
  pendingLabel: string
  pending: boolean
  /** Extra disable condition on top of `pending` (e.g. empty/unchanged). */
  disabled?: boolean
  rows?: number
  placeholder?: string
  error?: string | null
  success?: string | null
  className?: string
}) {
  return (
    <div className={className}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="rc-input w-full resize-y"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || pending}
          className="rounded-lg bg-rc-blue px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rc-navy disabled:opacity-40"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
        {success && <span className="text-sm text-rc-green">{success}</span>}
      </div>
    </div>
  )
}
