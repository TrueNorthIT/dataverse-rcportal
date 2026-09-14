import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Dialog, DialogBackdrop, DialogPanel, TransitionChild } from '@headlessui/react'
import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { DATAVERSE_URL, CLARITY_PROJECT_ID } from '../../env'
import { useMyCompany } from '../../hooks/useMyCompany'
import { useHideOnScroll } from '../../hooks/useHideOnScroll'
import { Icon } from '../common/Icon'
import { SidebarContent } from './Sidebar'
import { CompanySwitcher } from './CompanySwitcher'
import { UserMenu } from './UserMenu'

/**
 * Authenticated app frame — a sidebar layout.
 *
 * - lg and up: a fixed navy sidebar down the left (wordmark, sections, help,
 *   companies, account — see Sidebar) with the routed page beside it.
 * - Below lg: a slim navy top bar (menu button, wordmark, company switcher,
 *   user menu) that collapses on scroll-down, and the same sidebar as an
 *   off-canvas drawer. The drawer is a Headless UI Dialog, so it traps focus,
 *   inerts the page behind it, and closes on Escape or a backdrop press.
 *
 * Layering: the top bar is `sticky z-40`; the dashboard pins its scope toggle
 * above it at z-50 (see DashboardPage), header dropdowns escape via a body
 * portal at z-[60] (see AnchoredMenu), and the drawer also sits at z-[60] —
 * it is only ever open from the top bar, never alongside those menus.
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
  // Collapse the mobile top bar when scrolling down (reveal on scroll up) so
  // content gets the full screen on a phone. The desktop sidebar never hides.
  const navHidden = useHideOnScroll()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  // Any route change (a drawer link, or the browser back button while the
  // drawer is open) closes the drawer.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="rc-hero min-h-screen">
      {/* Mobile drawer */}
      <Dialog open={sidebarOpen} onClose={setSidebarOpen} className="relative z-[60] lg:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-rc-navy/60 backdrop-blur-sm transition-opacity duration-300 ease-linear data-closed:opacity-0"
        />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-closed:-translate-x-full"
          >
            <TransitionChild>
              <div className="absolute left-full top-0 flex w-16 justify-center pt-4 duration-300 ease-in-out data-closed:opacity-0">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Icon name="x" className="h-6 w-6" />
                </button>
              </div>
            </TransitionChild>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </DialogPanel>
        </div>
      </Dialog>

      {/* Desktop sidebar */}
      <aside
        aria-label="Sidebar"
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72 lg:flex-col"
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar. No transform when visible — `translate-y-0` still
          applies `transform: translateY(0)`, which creates a compositing layer
          that made the in-header dropdowns flaky to tap. Only transform while
          animating out. */}
      <header
        className={`sticky top-0 z-40 bg-rc-navy shadow-sm transition-transform duration-300 lg:hidden ${
          navHidden ? '-translate-y-full' : ''
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="-ml-2 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="menu" className="h-6 w-6" />
          </button>
          <img
            src="/brand/Redcentric_logo_white_no-strapline.png"
            alt="Redcentric"
            className="h-6 w-auto"
          />
          <div className="ml-auto flex items-center gap-3">
            <CompanySwitcher />
            <UserMenu />
          </div>
        </div>
        <div className="rc-gradient h-1 w-full" />
      </header>

      <div className="lg:pl-72">
        <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
          <Outlet />
        </main>

        {/* Operator/demo aids — the Dataverse deep link and the Clarity dashboard,
            for our operator logins only (never other demo logins or real
            customers). The "Clarity not configured" note is Steve-only, so a
            missing key is obvious to the maintainer without nagging anyone else. */}
        {isOperator && (
          <footer className="mx-auto max-w-5xl px-4 pb-8 pt-2 text-xs text-white/70 lg:px-8">
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
    </div>
  )
}
