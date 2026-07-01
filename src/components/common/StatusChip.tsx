/**
 * Small status pill for a choice `_label` (statuscode/statecode). Colour keys
 * off a coarse status family so open/won/lost read at a glance; unknown labels
 * fall back to a neutral brand tint.
 */
export function StatusChip({ label }: { label?: string | null }) {
  if (!label) return null
  const tone = toneFor(label)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  )
}

function toneFor(label: string): string {
  const l = label.toLowerCase()
  if (/(won|active|open|approved|complete|in progress)/.test(l)) {
    return 'bg-rc-green-light text-rc-green-dark'
  }
  if (/(lost|cancel|reject|closed|inactive|on hold)/.test(l)) {
    return 'bg-red-50 text-red-700'
  }
  if (/(draft|pending|new|proposed)/.test(l)) {
    return 'bg-rc-blue-light text-rc-navy'
  }
  return 'bg-rc-blue-light text-rc-teal'
}
