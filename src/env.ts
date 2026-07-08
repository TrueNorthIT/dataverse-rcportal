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

/**
 * Optional Dataverse environment URL — operator/demo aid only. When set (in the
 * deployment's env), a "View in Dataverse" link appears in the footer. Leave it
 * unset for a real customer deployment and the link simply doesn't render.
 */
export const DATAVERSE_URL = (import.meta.env.VITE_DATAVERSE_URL as string | undefined)?.replace(
  /\/$/,
  '',
)

/**
 * Optional MapTiler key — when set, the site detail page shows a styled map of
 * the address. Unset (a minimal deployment) simply hides the map. It
 * ships in the client bundle, so restrict the key to your domain in the
 * MapTiler dashboard.
 */
export const MAP_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined

/**
 * Optional Microsoft Clarity project id — user-interaction analytics for demos.
 * When set (e.g. in Vercel), Clarity loads and records clicks, scroll depth,
 * dwell time, heatmaps and full session replays, attributed to the signed-in
 * user. Unset (dev, tests, a minimal customer deployment) → Clarity never
 * loads and no third-party script ships. Create a free project (no session or
 * time limits) at https://clarity.microsoft.com to get the id.
 */
export const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined

/**
 * Deployment environment for analytics tagging — Vercel's framework-prefixed
 * VITE_VERCEL_ENV ("production" | "preview" | "development") when deployed
 * there, else Vite's mode (local dev / tests). Lets Clarity sessions be
 * filtered to production only, keeping preview/dev noise out of demo stats.
 */
export const DEPLOY_ENV =
  (import.meta.env.VITE_VERCEL_ENV as string | undefined) ?? import.meta.env.MODE
