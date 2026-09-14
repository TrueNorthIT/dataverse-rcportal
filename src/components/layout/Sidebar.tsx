import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import type { Company } from '@truenorth-it/dataverse-client'
import { accountToUser } from '../../config/entra'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { useFeedback } from '../common/FeedbackDialog'
import { Icon, type IconName } from '../common/Icon'
import { companyInitials } from './CompanySwitcher'
import { UserAvatar } from './UserMenu'

/**
 * Sidebar navigation — the contents of the fixed desktop rail and of the
 * mobile drawer (AppShell renders it in both places). Follows the Tailwind
 * Plus "simple sidebar" shell in the Redcentric palette. Top to bottom: the
 * brand wordmark over the signature gradient rule, the sections, a Help
 * group, the caller's companies when they act for more than one, and —
 * pinned to the bottom — the signed-in user (a link to their profile) with
 * sign-out beside it.
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

/** The sections: the customer's own data (spec §6) plus their company page. */
const CORE: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/opportunities', label: 'Opportunities', icon: 'activity' },
  { to: '/quotes', label: 'Quotes', icon: 'receipt' },
  { to: '/projects', label: 'Projects', icon: 'layers' },
  { to: '/sites', label: 'Sites', icon: 'mapPin' },
  { to: '/cases', label: 'Support', icon: 'lifeBuoy' },
  { to: '/company', label: 'My company', icon: 'building' },
]

/** Self-serve help. Feedback isn't a route — it opens a dialog — so it's
 * rendered as a button after these. */
const HELP: NavItem[] = [
  { to: '/knowledge', label: 'Knowledge base', icon: 'book' },
  { to: '/ai', label: 'AI assistant', icon: 'sparkles' },
]

/** Row chrome shared by links and buttons: the active row wears a soft white
 * wash, the rest brighten on hover. */
const rowClass = (active: boolean) =>
  'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ' +
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

          {/* Signed-in user, full-bleed like the template: the row links to the
              profile; sign-out sits beside it. */}
          <li className="-mx-4 mt-auto">
            <div className="flex items-center">
              <NavLink
                to="/profile"
                onClick={onNavigate}
                className={({ isActive }) =>
                  'flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-sm font-semibold text-white transition-colors ' +
                  (isActive ? 'bg-white/10' : 'hover:bg-white/5')
                }
              >
                <UserAvatar name={displayName} />
                <span className="min-w-0">
                  <span className="block truncate">{displayName}</span>
                  {user?.email && (
                    <span className="block truncate text-xs font-normal text-white/60">
                      {user.email}
                    </span>
                  )}
                </span>
              </NavLink>
              <button
                type="button"
                aria-label="Sign out"
                title="Sign out"
                onClick={() =>
                  void instance.logoutRedirect({
                    postLogoutRedirectUri: window.location.origin,
                  })
                }
                className="mr-3 rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon name="logOut" className={iconClass} />
              </button>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  )
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 text-xs font-semibold text-white/50">{children}</div>
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => rowClass(isActive)}
      >
        <Icon name={item.icon} className={iconClass} />
        {item.label}
      </NavLink>
    </li>
  )
}

/**
 * "Your companies" — one row per company the caller can act as, for the
 * multi-company case only, each with a bordered initials badge in the
 * template's style. Picking one sends its companyId into every request
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
                <span
                  aria-hidden="true"
                  className={
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/5 text-[10px] font-semibold transition-colors group-hover:text-white ' +
                    (active ? 'text-white' : 'text-white/70')
                  }
                >
                  {companyInitials(label(c))}
                </span>
                <span className="truncate">{label(c)}</span>
                {active && <Icon name="checkCircle" className="ml-auto h-4 w-4 shrink-0 text-white/60" />}
              </button>
            </li>
          )
        })}
      </ul>
    </li>
  )
}
