import { Outlet } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { useMyCompany } from '../../hooks/useMyCompany'
import { NavTabs } from './NavTabs'

/**
 * Authenticated app frame: brand top bar (logo, company, email, sign-out) with
 * the blue→teal gradient accent, the section nav, and a routed `<Outlet />`.
 */
export function AppShell() {
  const { instance, accounts } = useMsal()
  const user = accountToUser(instance.getActiveAccount() ?? accounts[0])
  const { account } = useMyCompany()

  return (
    <div className="min-h-screen bg-rc-canvas">
      <header className="bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src="/brand/Redcentric_logo_no-strapline.png"
              alt="Redcentric"
              className="h-6 w-auto"
            />
            <span className="hidden text-sm font-medium text-rc-teal sm:inline">
              Contact Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              {account?.name && (
                <div className="text-sm font-medium text-rc-navy">{account.name}</div>
              )}
              {user?.email && (
                <div className="text-xs text-rc-teal">{user.email}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                void instance.logoutRedirect({
                  postLogoutRedirectUri: window.location.origin,
                })
              }
              className="rounded-lg border border-rc-blue-light px-3 py-1.5 text-sm font-medium text-rc-navy hover:bg-rc-blue-light transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="rc-gradient h-1 w-full" />
        <NavTabs />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
