/**
 * Chart colours — hex values (recharts needs real colours, not Tailwind
 * classes). Aligned to the rc-* brand palette and, for projects, to the RAG
 * chip colours in projectHealth() so the donut, the list chip, and the filter
 * pill all read the same.
 */
export const HEALTH_COLORS: Record<string, string> = {
  ontrack: '#1c6b4f', // rc-green
  duesoon: '#f59e0b', // amber
  overdue: '#ef4444', // red
  complete: '#005862', // rc-teal
}

export const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  normal: '#f59e0b',
  low: '#1c6b4f',
}

export const QUOTE_COLORS: Record<string, string> = {
  active: '#0066b3', // rc-blue
  draft: '#94a3b8', // slate — clearly "not yet active"
}

/** Opportunity states — blue (in play), green (won), slate (lost/closed). */
export const OPPORTUNITY_COLORS: Record<string, string> = {
  open: '#0066b3', // rc-blue
  won: '#1c6b4f', // rc-green
  lost: '#94a3b8', // slate
}

/** Connectivity bars — a blue→teal→green→lime sweep echoing the brand gradient. */
export const CONNECTIVITY_COLORS = ['#0a5ca8', '#0e8aa0', '#005862', '#1c6b4f', '#8dc63f']

/** Respect the OS "reduce motion" setting for chart entrance animations. */
export function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
