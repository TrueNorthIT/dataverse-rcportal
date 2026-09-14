import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import type { Company } from '@truenorth-it/dataverse-client'
import { accountToUser } from '../../config/entra'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { useFeedback } from '../common/FeedbackDialog'
import { Icon, type IconName } from '../common/Icon'
import { CompanyAvatar } from './CompanySwitcher'
import { UserAvatar } from './UserMenu'

/**
 * Sidebar navigation — the contents of the fixed desktop rail and of the
 * mobile drawer (AppShell renders it in both places). Top to bottom: the brand
 * wordmark over the signature gradient rule, the core sections, a Help group,
 * the caller's companies when they act for more than one, and — pinned to the
 * bottom — the account pages plus the signed-in user with sign-out.
 *
 * Every interactive item calls `onNavigate` so the drawer can close itself;
 * the desktop rail leaves it unset.
 */
interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Match the route exactly (Dashboard lives at "/", which prefixes everything). */
  end?: boolean
}

/** Core sections — the customer's own data (spec §6). */
const CORE: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/opportunities', label: 'Opportunities', icon: 'activity' },
  { to: '/quotes', label: 'Quotes', icon: 'receipt' },
  { to: '/projects', label: 'Projects', icon: 'layers' },
  { to: '/sites', label: 'Sites', icon: 'mapPin' },
  { to: '/cases', label: 'Support', icon: 'lifeBuoy' },
]

/** Self-serve help. Feedback isn't a route — it opens a dialog — so it's
 * rendered as a button after these. */
const HELP: NavItem[] = [
  { to: '/knowledge', label: 'Knowledge base', icon: 'book' },
  { to: '/ai', label: 'AI assistant', icon: 'sparkles' },
]

/** Account-level pages — deliberately not core sections, which stay for the
 * customer's operational data. */
const ACCOUNT: NavItem[] = [
  { to: '/profile', label: 'My profile', icon: 'user' },
  { to: '/company', label: 'My company', icon: 'building' },
]

/** Row chrome shared by links and buttons. Active rows get a soft white wash;
 * the lime edge marker (see SidebarLink) is the brand's sparing accent. */
const rowClass = (active: boolean) =>
  'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ' +
  (active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')

const iconClass = 'h-5 w-5 shrink-0'

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { instance, accounts } = useMsal()
  const user = accountToUser(instance.getActiveAccount() ?? accounts[0])
  const feedback = useFeedback()
  const displayName = user?.name ?? user?.email ?? 'Account'

  return (
    <div className="flex grow flex-col overflow-y-auto bg-rc-navy">
      <div className="flex shrink-0 flex-col gap-1.5 px-6 pb-4 pt-5">
        <img
          src="/brand/Redcentric_logo_white_no-strapline.png"
          alt="Redcentric"
          className="h-7 w-auto self-start"
        />
        <span className="text-xs font-medium tracking-wide text-white/60">Customer Hub</span>
      </div>
      <div className="rc-gradient h-1 w-full" />

      <nav className="flex flex-1 flex-col px-4 py-5" aria-label="Primary">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="space-y-1">
              {CORE.map((item) => (
                <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </ul>
          </li>

          <li>
            <GroupLabel>Help</GroupLabel>
            <ul role="list" className="mt-2 space-y-1">
              {HELP.map((item) => (
                <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.()
                    feedback.open()
                  }}
                  className={rowClass(false)}
                >
                  <Icon name="message" className={iconClass} />
                  Feedback
                </button>
              </li>
            </ul>
          </li>

          <SidebarCompanies onNavigate={onNavigate} />

          <li className="mt-auto">
            <GroupLabel>Account</GroupLabel>
            <ul role="list" className="mt-2 space-y-1">
              {ACCOUNT.map((item) => (
                <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </ul>
            <div className="-mx-4 mt-5 border-t border-white/10 px-4 pt-4">
              <div className="flex items-center gap-3">
                <UserAvatar name={displayName} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                  {user?.email && (
                    <div className="truncate text-xs text-white/60">{user.email}</div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={() =>
                    void instance.logoutRedirect({
                      postLogoutRedirectUri: window.location.origin,
                    })
                  }
                  className="-mr-2 rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Icon name="logOut" className={iconClass} />
                </button>
              </div>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  )
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
      {children}
    </div>
  )
}

/** A section link. The active one carries a lime marker flush with the
 * sidebar edge: the nav has px-4, which is what -left-4 reaches across. */
function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => rowClass(isActive)}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-rc-lime"
              />
            )}
            <Icon name={item.icon} className={iconClass} />
            {item.label}
          </>
        )}
      </NavLink>
    </li>
  )
}

/**
 * "Your companies" — one row per company the caller can act as, for the
 * multi-company case only. Picking one sends its companyId into every request
 * (see SelectedCompanyContext); the current one is ticked.
 */
function SidebarCompanies({ onNavigate }: { onNavigate?: () => void }) {
  const { companies, hasMultiple, currentCompany, selectCompany } = useSelectedCompany()
  if (!hasMultiple) return null

  const label = (c: Company) => c.companyName ?? c.fullname ?? 'Company'

  return (
    <li>
      <GroupLabel>Your companies</GroupLabel>
      <ul role="list" className="mt-2 space-y-1">
        {companies.map((c) => {
          const active = c.companyId === currentCompany?.companyId
          return (
            <li key={c.companyId}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  selectCompany(c.companyId)
                  onNavigate?.()
                }}
                className={rowClass(active)}
              >
                <CompanyAvatar name={label(c)} small />
                <span className="truncate">{label(c)}</span>
                {active && <Icon name="checkCircle" className="ml-auto h-4 w-4 shrink-0 text-rc-lime" />}
              </button>
            </li>
          )
        })}
      </ul>
    </li>
  )
}
