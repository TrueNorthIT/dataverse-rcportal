/** Display formatters shared across list/detail screens. */

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

/** Money as GBP, e.g. 125000 → "£125,000". Empty for null/undefined. */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return gbp.format(value)
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** ISO date/datetime → "5 Jul 2026". Empty for null/undefined/invalid. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFmt.format(d)
}

/** A day count as a friendly span, e.g. 5→"5 days", 21→"3 weeks", 120→"4 months". */
export function humanDuration(days: number): string {
  const n = Math.abs(Math.round(days))
  if (n >= 60) return `${Math.round(n / 30)} months`
  if (n >= 14) return `${Math.round(n / 7)} weeks`
  if (n >= 1) return `${n} day${n === 1 ? '' : 's'}`
  return 'less than a day'
}

/** ISO date → human relative phrase, e.g. "12 days ago" / "in 3 months" / "today". */
export function relativeFromNow(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const diffDays = Math.round((d.getTime() - Date.now()) / 86_400_000)
  if (diffDays === 0) return 'today'
  return diffDays < 0 ? `${humanDuration(diffDays)} ago` : `in ${humanDuration(diffDays)}`
}
