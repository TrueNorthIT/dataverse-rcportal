import { Outlet } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { DATAVERSE_URL } from '../../env'
import { useMyCompany } from '../../hooks/useMyCompany'
import { useHideOnScroll } from '../../hooks/useHideOnScroll'
import { NavTabs } from './NavTabs'
import { CompanySwitcher } from './CompanySwitcher'
import { UserMenu } from './UserMenu'

/**
 * Authenticated app frame: brand top bar (logo, company switcher, user menu)
 * with the blue→teal gradient accent, the section nav, and a routed `<Outlet />`.
 */
export function AppShell() {
  const { instance, accounts } = useMsal()
  const user = accountToUser(instance.getActiveAccount() ?? accounts[0])
  const { account } = useMyCompany()
  // The Dataverse deep link is a demo/operator aid — only surface it for the
  // operator account, never for other demo logins or real customers.
  const isOperator = user?.email?.toLowerCase() === 'steve@drakey.co.uk'
  // Collapse the brand bar + nav when scrolling down (reveal on scroll up) so
  // content gets the full screen — reads much better on mobile.
  const navHidden = useHideOnScroll()

  return (
    <div className="rc-hero min-h-screen">
      <header
        className={`sticky top-0 z-40 bg-rc-navy shadow-sm transition-transform duration-300 ${
          navHidden ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <img
              src="/brand/Redcentric_logo_white_no-strapline.png"
              alt="Redcentric"
              className="h-7 w-auto"
            />
            <span className="relative top-[3px] hidden text-sm font-medium text-white/70 sm:inline">
              Customer Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <CompanySwitcher />
            <UserMenu />
          </div>
        </div>
        <div className="rc-gradient h-1 w-full" />
        <NavTabs />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>

      {/* Operator/demo aid: jump to the backing record in Dataverse. Shown only
          when VITE_DATAVERSE_URL is set AND the operator (Steve) is signed in —
          never for other demo logins or real customers. */}
      {DATAVERSE_URL && isOperator && (
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
