/**
 * Environment access with fail-fast validation.
 *
 * We read every VITE_* var through requireEnvVar so a missing value throws a
 * clear error at startup instead of surfacing as a confusing auth/network
 * failure deep in the app. All are baked into the bundle at build time
 * (Vite only exposes vars prefixed with VITE_ to client code).
 */
function requireEnvVar(name: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv] as string | undefined
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill it in (see README).`,
    )
  }
  return value
}

export const env = {
  /** Entra External ID tenant (CIAM) id — builds the MSAL authority. */
  ENTRA_TENANT_ID: requireEnvVar('VITE_ENTRA_TENANT_ID'),
  /** SPA app registration (client) id in that tenant. */
  ENTRA_CLIENT_ID: requireEnvVar('VITE_ENTRA_CLIENT_ID'),
  /** API access scope requested at sign-in, "api://<api-app-id>/access_as_user". */
  ENTRA_API_SCOPE: requireEnvVar('VITE_ENTRA_API_SCOPE'),
  /** Full API base incl. scope path, e.g. "https://.../api/v2/rcportal". */
  API_BASE_URL: requireEnvVar('VITE_API_BASE_URL'),
}
