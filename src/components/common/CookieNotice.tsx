import { useState } from 'react'
import { CLARITY_PROJECT_ID } from '../../env'
import {
  clarityConsent,
  getStoredClarityConsent,
} from '../../lib/clarity'

/**
 * One-time analytics cookie notice (UK PECR: analytics cookies are
 * non-essential, so they need a real choice). Shown after sign-in, only when
 * Clarity is configured and the visitor hasn't chosen yet; the choice persists
 * per browser. Accept signals consent to Clarity (cookies from then on);
 * decline is remembered and initClarity skips loading entirely on future
 * visits, so declined users are never tracked — cookieless or otherwise.
 */
export function CookieNotice({
  projectId = CLARITY_PROJECT_ID,
}: {
  projectId?: string | undefined
}) {
  const [choice, setChoice] = useState(getStoredClarityConsent)

  if (!projectId || choice) return null

  const decide = (granted: boolean) => {
    clarityConsent(granted)
    setChoice(granted ? 'granted' : 'denied')
  }

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="rc-fade-up fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-5"
    >
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-xl">
        <div className="rc-gradient h-1 w-full" />
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-5">
          <p className="flex-1 text-sm leading-relaxed text-rc-navy">
            <span className="font-medium">Can we use analytics cookies?</span>{' '}
            <span className="text-rc-teal">
              We use Microsoft Clarity to see how the portal is used — session
              replays and heatmaps — to make it better. No advertising, ever.
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => decide(false)}
              className="rounded-lg border border-rc-blue-light px-4 py-2 text-sm font-medium text-rc-navy transition-colors hover:bg-rc-blue-light/40"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={() => decide(true)}
              className="rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rc-navy"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
