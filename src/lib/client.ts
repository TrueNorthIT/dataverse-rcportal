import { useMemo } from 'react'
import { createClient } from '@truenorth-it/dataverse-client'
import { apiOrigin, dataverseScope } from '../config/entra'
import { useGetToken } from './getToken'
import { useSelectedCompany } from '../context/SelectedCompanyContext'

/**
 * Authenticated Dataverse client, bound to the signed-in user.
 *
 * `getToken` hands the SDK a fresh Entra External ID access token on every
 * request — the SDK adds the `Authorization: Bearer` header, builds OData
 * query strings, and normalises errors into `ApiError`. Never set headers or
 * build `$filter` strings by hand; go through the SDK.
 *
 * When the caller is a contact under more than one company and has picked one,
 * the selected `contactId` is threaded in here so the SDK sends the
 * `X-Contact-Id` header on every request — meaning all tiers, lists, and
 * pagination automatically act as the chosen company. The server verifies the
 * contact belongs to the caller. With no selection the API uses the default
 * (earliest-created) company. See `SelectedCompanyContext`.
 *
 * Use the tier that matches the access you need:
 *   client.me   — records linked to the caller's own contact (this portal)
 *   client.team — records across the caller's account/team
 *   client.all  — every record (needs an `:all` permission on the token)
 */
export function useDataverseClient() {
  const getToken = useGetToken()
  const { selectedContactId } = useSelectedCompany()
  return useMemo(
    () =>
      createClient({
        baseUrl: apiOrigin,
        scope: dataverseScope,
        getToken,
        ...(selectedContactId ? { contactId: selectedContactId } : {}),
      }),
    [getToken, selectedContactId],
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
