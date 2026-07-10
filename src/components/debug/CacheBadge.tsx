import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { useApiDebug } from '../../lib/cacheDebug'

/**
 * Tiny per-tile diagnostics overlay, visible ONLY to the debug user — shows
 * how the tile's data actually arrived: server cache HIT/MISS (X-Cache),
 * fetch duration + status, when it last refreshed, and the session hit rate
 * for that endpoint. Everyone else renders nothing.
 *
 * Drop inside any positioned container (the tile Card needs `relative`):
 *
 *   <CacheBadge match="/aggregate/case" />
 *
 * `match` is a substring of the API URL (path + query) that feeds the tile,
 * or a predicate for precision, e.g.
 *   (u) => u.includes('/aggregate/case') && !u.includes('filter=')
 */

/** The only user who sees the badges. */
export const DEBUG_USER_EMAIL = 'sdrake@truenorthit.co.uk'

export function isDebugUser(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase() === DEBUG_USER_EMAIL
}

const timeFmt = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour12: false })

export function CacheBadge({
  match,
  label,
}: {
  match: string | ((url: string) => boolean)
  /** Optional short name shown before the stats (handy when tiles overlap endpoints). */
  label?: string
}) {
  const { instance, accounts } = useMsal()
  const email = accountToUser(instance.getActiveAccount() ?? accounts[0])?.email
  // Hooks may not be conditional — compute stats before the visibility gate.
  const { last, count, hits, misses } = useApiDebug(match)
  if (!isDebugUser(email)) return null

  const tone =
    last?.cache === 'HIT'
      ? 'text-emerald-700'
      : last?.cache === 'MISS'
        ? 'text-amber-700'
        : 'text-slate-500'
  const measured = hits + misses
  const hitPct = measured > 0 ? Math.round((hits / measured) * 100) : null

  return (
    <div
      data-testid="cache-badge"
      title={last?.url}
      className={`pointer-events-none absolute bottom-1 right-1.5 z-10 rounded bg-white/85 px-1.5 py-0.5 text-right font-mono text-[9px] leading-snug ${tone}`}
    >
      {last ? (
        <>
          <div>
            {label ? `${label} · ` : ''}
            {last.cache ?? 'no-cache'} · {last.durationMs}ms
            {last.status !== 200 ? ` · ${last.status}` : ''}
          </div>
          <div>
            {timeFmt(last.receivedAt)} · {count} req{hitPct != null ? ` · ${hitPct}% hit` : ''}
          </div>
        </>
      ) : (
        <div>{label ? `${label} · ` : ''}no request</div>
      )}
    </div>
  )
}
