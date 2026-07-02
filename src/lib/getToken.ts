import { useMemo } from 'react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { useMsal } from '@azure/msal-react'
import { entraConfig } from '../config/entra'

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
        if (err instanceof InteractionRequiredAuthError) {
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
