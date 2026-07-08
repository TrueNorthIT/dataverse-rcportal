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
 * The visitor's stored cookie-consent choice, persisted per browser so the
 * cookie notice is asked once. Clarity enforces Consent Mode for UK/EEA/CH
 * traffic (since Oct 2025): without a granted signal it runs cookieless and
 * counts a NEW unique user per page view — which is how one developer became
 * "209 unique users". Grant restores real user counts; decline means we don't
 * load Clarity at all, so declined visitors can't inflate the numbers either.
 */
const CONSENT_KEY = 'rcportal.clarityConsent'

export type ClarityConsentChoice = 'granted' | 'denied'

/** The persisted consent choice, or null when the visitor hasn't chosen yet. */
export function getStoredClarityConsent(): ClarityConsentChoice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

/**
 * Record the visitor's choice and signal it to Clarity. Ad storage is always
 * denied — the portal runs no ads; granting covers analytics cookies only.
 */
export function clarityConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
  } catch {
    // Persistence is best-effort — the signal below still applies this session.
  }
  clarity('consentv2', {
    ad_Storage: 'denied',
    analytics_Storage: granted ? 'granted' : 'denied',
  })
}

/**
 * Inject the Clarity loader — the official queue-shim snippet, expressed in TS.
 * Idempotent (guards on `window.clarity`) and a safe no-op when unconfigured,
 * off-DOM (tests), or when the visitor has declined cookies. Returns whether
 * Clarity is now active so callers can skip follow-up work.
 */
export function initClarity(projectId: string | undefined = CLARITY_PROJECT_ID): boolean {
  if (!projectId) return false
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (window.clarity) return true // already initialised
  if (getStoredClarityConsent() === 'denied') return false

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

  // Returning visitor who already accepted → re-signal straight away (queued
  // until the script loads) so the session runs with cookies from first paint.
  if (getStoredClarityConsent() === 'granted') {
    clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' })
  }
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
 * Attach a session-level custom tag — Clarity's filter dimension. Tags don't
 * mark moments; they label the session so recordings/heatmaps can be sliced in
 * the dashboard (e.g. company = "Chevin Print", env = "production").
 */
export function claritySetTag(key: string, value: string): void {
  clarity('set', key, value)
}

/**
 * Tag the active route on the session timeline (a Clarity custom tag) so
 * replays and heatmaps can be sliced by page. Called on every navigation.
 */
export function clarityTrackPage(path: string): void {
  claritySetTag('page', path)
}

/**
 * Mark a named moment (a Clarity custom event): a pin on the replay timeline
 * and a filterable "smart event" in the dashboard. Fire these at the actions
 * that matter in a demo — ticket raised, feedback sent, MCP URL copied — so
 * "show me every session where X happened" is one filter away.
 */
export function clarityEvent(name: string): void {
  clarity('event', name)
}

/**
 * Ask Clarity to prioritise keeping this session's recording (Clarity samples
 * under load). Fire alongside high-value events so the sessions worth showing
 * in a demo are never the ones sampled away.
 */
export function clarityUpgrade(reason: string): void {
  clarity('upgrade', reason)
}
