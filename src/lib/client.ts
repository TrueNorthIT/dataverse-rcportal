import { useMemo } from 'react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { useMsal } from '@azure/msal-react'
import { createClient } from '@truenorth-it/dataverse-client'
import { apiOrigin, dataverseScope, entraConfig } from '../config/entra'

/**
 * Authenticated Dataverse client, bound to the signed-in user.
 *
 * `getToken` hands the SDK a fresh Entra External ID access token on every
 * request — the SDK adds the `Authorization: Bearer` header, builds OData
 * query strings, and normalises errors into `ApiError`. Never set headers or
 * build `$filter` strings by hand; go through the SDK.
 *
 * Falls back to an interactive redirect if the silent acquisition needs UI
 * (e.g. consent prompt, expired refresh token).
 *
 * Use the tier that matches the access you need:
 *   client.me   — records linked to the caller's own contact (this portal)
 *   client.team — records across the caller's account/team
 *   client.all  — every record (needs an `:all` permission on the token)
 */
export function useDataverseClient() {
  const { instance, accounts } = useMsal()
  return useMemo(
    () =>
      createClient({
        baseUrl: apiOrigin,
        scope: dataverseScope,
        getToken: async () => {
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
      }),
    [instance, accounts],
  )
}

/**
 * Public (unauthenticated) client singleton — only `client.public.list/get`
 * and the invoke* helpers work here. Handy for anything you want to render
 * before the user signs in.
 */
export const publicClient = createClient({
  baseUrl: apiOrigin,
  scope: dataverseScope,
})
