import type { AccountInfo } from '@azure/msal-browser'
import { env } from '../env'

/**
 * Microsoft Entra External ID (CIAM) config for MSAL. The Contact API migrated
 * off Auth0 to Entra External ID, so the SPA signs in with @azure/msal-browser
 * (PKCE redirect flow) rather than the Auth0 SDK. Mirrors the sibling app
 * dataverse-rbooking. Values come from the SPA app registration.
 *
 *   apiScope → the Entra token scope requested at sign-in / silent refresh.
 */
export const entraConfig = {
  tenantId: env.ENTRA_TENANT_ID,
  clientId: env.ENTRA_CLIENT_ID,
  /** e.g. "api://<api-app-id>/access_as_user" */
  apiScope: env.ENTRA_API_SCOPE,
  redirectUri: window.location.origin,
}

/**
 * The dataverse-client wants the API *origin* + the scope *name* separately —
 * not the full "/api/v2/<scope>" path. We derive both from VITE_API_BASE_URL
 * so there's a single source of truth.
 *
 *   https://api.dataverse-contact.tnapps.co.uk/api/v2/rcportal
 *   → origin "https://api.dataverse-contact.tnapps.co.uk", scope "rcportal"
 */
const apiUrl = new URL(env.API_BASE_URL)
export const apiOrigin = apiUrl.origin
export const dataverseScope = apiUrl.pathname.split('/').filter(Boolean).pop() ?? 'default'

/** Deep link into the API's own reference/health page (handy demo aid). */
export const apiBaseUrl = env.API_BASE_URL

/** Normalised user shape the UI consumes — keeps components MSAL-agnostic. */
export interface AppUser {
  /** MSAL account id — stable per-user identifier (homeAccountId). */
  id: string
  email?: string
  name?: string
  /** Given name from the token (given_name claim, else the first word of name). */
  firstName?: string
  /** Family name from the token (family_name claim, else the rest of name). */
  lastName?: string
}

export function accountToUser(
  account: AccountInfo | null | undefined,
): AppUser | undefined {
  if (!account) return undefined
  const claims = (account.idTokenClaims ?? {}) as Record<string, unknown>
  const claim = (key: string) =>
    typeof claims[key] === 'string' ? (claims[key] as string) : undefined

  const preferred = claim('preferred_username')
  const email =
    claim('email') ??
    (preferred && preferred.includes('@') ? preferred : undefined) ??
    (account.username && account.username.includes('@') ? account.username : undefined)

  const name = claim('name') ?? account.name
  // Prefer the explicit given/family claims; otherwise split the display name so
  // the join form can still be pre-filled (first word → first name, rest → last).
  const [firstWord, ...restWords] = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const firstName = claim('given_name') ?? firstWord
  const lastName = claim('family_name') ?? (restWords.length ? restWords.join(' ') : undefined)

  return {
    id: account.homeAccountId,
    email,
    name,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
  }
}
