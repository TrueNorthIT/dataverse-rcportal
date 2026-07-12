import { useMemo } from 'react'
import { BrowserAuthError, InteractionRequiredAuthError } from '@azure/msal-browser'
import { useMsal } from '@azure/msal-react'
import { entraConfig } from '../config/entra'

/**
 * BrowserAuthError codes MSAL raises when its hidden-iframe silent renewal is
 * exhausted — the SPA refresh token has expired (Entra caps SPA refresh tokens
 * at ~24h) and the fallback iframe to the authorize endpoint can't complete
 * because third-party cookies are blocked or the Entra session is gone. These
 * aren't InteractionRequiredAuthErrors, but they mean the same thing: silent is
 * done, so send the user to interactive sign-in rather than dead-ending on a
 * stuck screen with no API calls (the "come back the next day, nothing loads"
 * report). In MSAL v5 the iframe monitor timeout is `timed_out`, not the
 * legacy `monitor_window_timeout`.
 */
const SILENT_EXHAUSTED = new Set([
  'timed_out', // iframe/bridge monitor timed out — usually blocked cookies
  'hash_empty_error', // iframe returned, but with no usable auth response
  'empty_window_error',
  'iframe_closed_prematurely',
])

/**
 * Returns a `getToken()` function that hands out a fresh Entra External ID
 * access token, falling back to an interactive redirect when silent
 * acquisition needs UI. Extracted so both the SDK client hook and the
 * company context can acquire tokens without importing each other.
 */
export function useGetToken(): () => Promise<string> {
  const { instance, accounts } = useMsal()
  return useMemo(
    () => async () => {
      const account = instance.getActiveAccount() ?? accounts[0]
      if (!account) throw new Error('Not signed in')
      try {
        const result = await instance.acquireTokenSilent({
          scopes: [entraConfig.apiScope],
          account,
        })
        return result.accessToken
      } catch (err) {
        // Recover with an interactive redirect when silent acquisition can't be
        // renewed — either an explicit InteractionRequiredAuthError or a spent
        // iframe renewal (see SILENT_EXHAUSTED). Anything else (network blip,
        // interaction already in progress) is rethrown untouched so we don't
        // bounce the user out on a transient error or loop the redirect.
        const needsInteraction =
          err instanceof InteractionRequiredAuthError ||
          (err instanceof BrowserAuthError && SILENT_EXHAUSTED.has(err.errorCode))
        if (needsInteraction) {
          await instance.acquireTokenRedirect({
            scopes: [entraConfig.apiScope],
            account,
          })
        }
        throw err
      }
    },
    [instance, accounts],
  )
}
