import { useMsal } from '@azure/msal-react'
import { entraConfig } from '../config/entra'

/**
 * Unauthenticated landing screen. `loginRedirect` sends the user to Entra
 * External ID and returns them to `redirectUri` (the app origin) — the
 * MsalProvider bootstrap in main.tsx handles the callback automatically.
 */
export function LoginScreen() {
  const { instance } = useMsal()

  return (
    <div className="min-h-screen flex items-center justify-center bg-rc-canvas px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-sm">
        {/* Signature blue → teal accent, echoing the logo rules. */}
        <div className="rc-gradient h-1.5 w-full" />
        <div className="p-8 text-center">
          <img
            src="/brand/Redcentric_logo_no-strapline.png"
            alt="Redcentric"
            className="mx-auto h-8 w-auto"
          />
          <h1 className="mt-6 text-2xl font-bold text-rc-navy">
            Contact Portal
          </h1>
          <p className="mt-2 text-sm text-rc-teal">
            Sign in to view and manage your contact details.
          </p>
          <button
            type="button"
            onClick={() =>
              void instance.loginRedirect({ scopes: [entraConfig.apiScope] })
            }
            className="mt-6 w-full rounded-lg bg-rc-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-rc-navy transition-colors"
          >
            Sign in
          </button>
          <p className="mt-4 text-xs text-rc-teal/70">
            Powered by the Dataverse Contact API
          </p>
        </div>
      </div>
    </div>
  )
}
