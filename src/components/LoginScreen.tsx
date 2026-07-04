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
    <div className="rc-hero relative flex min-h-screen items-center justify-center px-4 text-center">
      <div className="relative z-10 w-full max-w-md">
        <img
          src="/brand/Redcentric_logo_white_no-strapline.png"
          alt="Redcentric"
          className="mx-auto h-10 w-auto"
        />
        <h1 className="mt-10 text-4xl font-light tracking-tight text-white">Customer Portal</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-white/80">
          Sign in to view and manage your contact details, quotes, projects and
          support — all in one place.
        </p>
        <button
          type="button"
          onClick={() => void instance.loginRedirect({ scopes: [entraConfig.apiScope] })}
          className="mt-8 rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-rc-navy shadow-sm hover:bg-rc-blue-light transition-colors"
        >
          Sign in
        </button>
        <p className="mt-6 text-xs text-white/60">Powered by the Dataverse Contact API</p>
      </div>
    </div>
  )
}
