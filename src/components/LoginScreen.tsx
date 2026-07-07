import { useMsal } from '@azure/msal-react'
import { entraConfig } from '../config/entra'

/**
 * Unauthenticated landing screen. `loginRedirect` sends the user to Entra
 * External ID and returns them to `redirectUri` (the app origin) — the
 * MsalProvider bootstrap in main.tsx handles the callback automatically.
 *
 * Two entry points: "Sign in" (the standard flow) and "Create an account",
 * which passes `prompt: 'create'` so Entra External ID opens the sign-up page
 * directly — no need to start signing in and hunt for "No account? Create one".
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
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void instance.loginRedirect({ scopes: [entraConfig.apiScope] })}
            className="w-full max-w-xs rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-rc-navy shadow-sm transition-colors hover:bg-rc-blue-light"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() =>
              void instance.loginRedirect({ scopes: [entraConfig.apiScope], prompt: 'create' })
            }
            className="w-full max-w-xs rounded-lg border border-white/40 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Create an account
          </button>
        </div>
        <p className="mx-auto mt-5 max-w-xs text-xs text-white/70">
          New here? Create an account in a couple of minutes — then tell us which
          companies you work with.
        </p>
        <p className="mt-4 text-xs text-white/60">Powered by the Dataverse Contact API</p>
      </div>
    </div>
  )
}
