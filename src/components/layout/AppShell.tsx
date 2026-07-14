import { Outlet } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { DATAVERSE_URL, CLARITY_PROJECT_ID } from '../../env'
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
  // Operator/demo aids (Dataverse deep link, Clarity dashboard) — for anyone on
  // the TrueNorth team (plus Steve's personal operator login), never for other
  // demo users or real customers.
  const email = user?.email?.toLowerCase()
  const isOperator = email === 'steve@drakey.co.uk' || email?.endsWith('@truenorthit.co.uk') === true
  const isSteve = email === 'steve@drakey.co.uk'
  // Collapse the brand bar + nav when scrolling down (reveal on scroll up) so
  // content gets the full screen — reads much better on mobile.
  const navHidden = useHideOnScroll()

  return (
    <div className="rc-hero min-h-screen">
      {/* No transform when visible — `translate-y-0` still applies
          `transform: translateY(0)`, which creates a compositing/stacking layer
          that made the in-header dropdowns flaky to tap. Only transform while
          animating out. */}
      <header
        className={`sticky top-0 z-40 bg-rc-navy shadow-sm transition-transform duration-300 ${
          navHidden ? '-translate-y-full' : ''
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
              Customer Hub
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

      {/* Operator/demo aids — the Dataverse deep link and the Clarity dashboard,
          for our operator logins only (never other demo logins or real
          customers). The "Clarity not configured" note is Steve-only, so a
          missing key is obvious to the maintainer without nagging anyone else. */}
      {isOperator && (
        <footer className="mx-auto max-w-5xl px-4 pb-8 pt-2 text-xs text-white/70">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {DATAVERSE_URL && (
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
            )}
            {CLARITY_PROJECT_ID ? (
              <a
                href={`https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/dashboard`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-white hover:underline"
              >
                Clarity analytics ↗
              </a>
            ) : (
              isSteve && (
                <span className="text-amber-300/90">
                  Clarity not configured — set VITE_CLARITY_PROJECT_ID
                </span>
              )
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
