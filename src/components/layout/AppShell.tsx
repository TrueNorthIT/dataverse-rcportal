import { Outlet } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { DATAVERSE_URL } from '../../env'
import { useMyCompany } from '../../hooks/useMyCompany'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { NavTabs } from './NavTabs'
import { CompanySwitcher } from './CompanySwitcher'

/**
 * Authenticated app frame: brand top bar (logo, company, email, sign-out) with
 * the blue→teal gradient accent, the section nav, and a routed `<Outlet />`.
 */
export function AppShell() {
  const { instance, accounts } = useMsal()
  const user = accountToUser(instance.getActiveAccount() ?? accounts[0])
  const { account } = useMyCompany()
  // When the caller belongs to multiple companies, the switcher names the
  // active company, so the static name would be redundant.
  const { hasMultiple } = useSelectedCompany()

  return (
    <div className="rc-hero min-h-screen">
      <header className="sticky top-0 z-40 bg-rc-navy shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <img
              src="/brand/Redcentric_logo_white_no-strapline.png"
              alt="Redcentric"
              className="h-7 w-auto"
            />
            <span className="relative top-[3px] hidden text-sm font-medium text-white/70 sm:inline">
              Contact Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <CompanySwitcher />
            <div className="hidden text-right sm:block">
              {!hasMultiple && account?.name && (
                <div className="text-sm font-medium text-white">{account.name}</div>
              )}
              {user?.email && (
                <div className="text-xs text-white/70">{user.email}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                void instance.logoutRedirect({
                  postLogoutRedirectUri: window.location.origin,
                })
              }
              className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
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

      {/* Operator/demo aid: jump to the backing record in Dataverse. Only
          rendered when VITE_DATAVERSE_URL is set — leave it unset for customers. */}
      {DATAVERSE_URL && (
        <footer className="mx-auto max-w-5xl px-4 pb-8 pt-2 text-xs text-white/70">
          <a
            href={
              account?.accountid
                ? `${DATAVERSE_URL}/main.aspx?pagetype=entityrecord&etn=account&id=${account.accountid}`
                : DATAVERSE_URL
            }
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-white hover:underline"
          >
            {account?.name ? `View ${account.name} in Dataverse` : 'Open Dataverse environment'} ↗
          </a>
        </footer>
      )}
    </div>
  )
}
