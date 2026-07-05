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

/**
 * Clean a Dataverse description for display. Demo records carry a
 * "[DEMO-RCPORTAL]" cleanup marker (kept for seed idempotency) and some legacy
 * rows carry "Fictional demo … not real data." boilerplate — strip both so the
 * UI shows only the real copy.
 */
export function cleanDescription(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\[DEMO-RCPORTAL\]/g, '')
    .replace(/Fictional demo[^.]*\./gi, '')
    .trim()
}

/** A day count as a friendly span, e.g. 5→"5 days", 21→"3 weeks", 120→"4 months". */
export function humanDuration(days: number): string {
  const n = Math.abs(Math.round(days))
  if (n >= 60) return `${Math.round(n / 30)} months`
  if (n >= 14) return `${Math.round(n / 7)} weeks`
  if (n >= 1) return `${n} day${n === 1 ? '' : 's'}`
  return 'less than a day'
}

/** Only phrase dates relatively within this window; beyond it, show the date. */
const RELATIVE_HORIZON_DAYS = 90

/**
 * ISO date → human relative phrase when it's near (within ~3 months), e.g.
 * "today" / "in 3 days" / "2 weeks ago". Beyond that horizon a relative phrase
 * ("in 8 months") is more noise than signal, so fall back to the actual date.
 */
export function relativeFromNow(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const diffDays = Math.round((d.getTime() - Date.now()) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (Math.abs(diffDays) > RELATIVE_HORIZON_DAYS) return formatDate(value)
  return diffDays < 0 ? `${humanDuration(diffDays)} ago` : `in ${humanDuration(diffDays)}`
}
