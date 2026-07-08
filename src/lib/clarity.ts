/**
 * Microsoft Clarity integration — session replay, heatmaps and user-interaction
 * analytics (clicks, scroll depth, dwell time, rage/dead clicks) for demos.
 *
 * Everything here is a no-op unless VITE_CLARITY_PROJECT_ID is set: with no
 * project id (dev, tests, a minimal customer deployment) the loader is never
 * injected and no third-party script ships. The id is created for free — no
 * session or time limits — at https://clarity.microsoft.com and dropped into
 * the deployment's env (we set it in Vercel).
 */
import { CLARITY_PROJECT_ID } from '../env'
import type { AppUser } from '../config/entra'

/** The global `clarity` command queue Microsoft's loader installs. */
type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] }

declare global {
  interface Window {
    clarity?: ClarityFn
  }
}

/**
 * Inject the Clarity loader — the official queue-shim snippet, expressed in TS.
 * Idempotent (guards on `window.clarity`) and a safe no-op when unconfigured or
 * off-DOM (tests). Returns whether Clarity is now active so callers can skip
 * follow-up work.
 */
export function initClarity(projectId: string | undefined = CLARITY_PROJECT_ID): boolean {
  if (!projectId) return false
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (window.clarity) return true // already initialised

  // Queue shim: commands issued before the async script finishes loading are
  // buffered on `clarity.q` and replayed once it does.
  const fn: ClarityFn = (...args: unknown[]) => {
    ;(fn.q = fn.q || []).push(args)
  }
  window.clarity = fn

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${projectId}`
  const first = document.getElementsByTagName('script')[0]
  if (first?.parentNode) first.parentNode.insertBefore(script, first)
  else document.head.appendChild(script)
  return true
}

/** Issue a Clarity command if Clarity is active; otherwise a no-op. */
function clarity(...args: unknown[]): void {
  if (typeof window === 'undefined' || !window.clarity) return
  window.clarity(...args)
}

/**
 * Attribute the current session to the signed-in user so recordings and
 * heatmaps are filterable by who was using the portal, rather than anonymous.
 * Clarity hashes the custom id; we pass the email (or name) as the friendly
 * label shown in the dashboard. No user → left anonymous.
 */
export function clarityIdentify(user: AppUser | undefined): void {
  if (!user) return
  clarity('identify', user.id, undefined, undefined, user.email ?? user.name)
}

/**
 * Tag the active route on the session timeline (a Clarity custom tag) so
 * replays and heatmaps can be sliced by page. Called on every navigation.
 */
export function clarityTrackPage(path: string): void {
  clarity('set', 'page', path)
}
