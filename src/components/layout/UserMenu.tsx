import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { useMyCompany } from '../../hooks/useMyCompany'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'

/**
 * Signed-in user chip in the header: avatar + first name (avatar only on the
 * smallest screens) opening a popover with the full name/email, links to
 * "My profile" / "My company", and sign out. This is the sole home of those
 * two account-level pages — they're deliberately not core nav tabs, which
 * keeps the tab row for the customer's operational data.
 */
const MENU_LINKS = [
  { to: '/profile', label: 'My profile' },
  { to: '/company', label: 'My company' },
]

export function UserMenu() {
  const { instance, accounts } = useMsal()
  const user = accountToUser(instance.getActiveAccount() ?? accounts[0])
  const { account } = useMyCompany()
  // With multiple companies the switcher already names the active one, so the
  // popover only repeats the company for the common single-company case.
  const { hasMultiple } = useSelectedCompany()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // pointerdown fires reliably on the first press (mouse or touch); mousedown
    // is synthesized late on touch and made the first tap flaky.
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const displayName = user?.name ?? user?.email ?? 'Account'
  const firstName = displayName.split(/\s+/)[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-white/25 py-1 pl-1 pr-2 text-sm text-white transition-colors hover:bg-white/10 sm:pr-3"
      >
        <UserAvatar name={displayName} />
        <span className="hidden max-w-[160px] truncate font-medium sm:inline">
          {firstName}
        </span>
        <Chevron className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-max min-w-[15rem] max-w-[20rem] overflow-hidden rounded-xl border border-rc-blue-light bg-white shadow-xl"
        >
          <div className="rc-gradient h-1 w-full" />
          <div className="border-b border-rc-blue-light/60 px-4 py-3">
            <div className="truncate text-sm font-semibold text-rc-navy">{displayName}</div>
            {user?.email && (
              <div className="truncate text-xs text-rc-teal">{user.email}</div>
            )}
            {!hasMultiple && account?.name && (
              <div className="mt-0.5 truncate text-xs text-rc-teal">{account.name}</div>
            )}
          </div>
          {MENU_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                'block px-4 py-2.5 text-sm transition-colors ' +
                (isActive
                  ? 'bg-rc-blue-light/50 font-medium text-rc-navy'
                  : 'text-rc-teal hover:bg-rc-blue-light/30 hover:text-rc-navy')
              }
            >
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              void instance.logoutRedirect({
                postLogoutRedirectUri: window.location.origin,
              })
            }
            className="block w-full border-t border-rc-blue-light/60 px-4 py-2.5 text-left text-sm text-rc-teal transition-colors hover:bg-rc-blue-light/30 hover:text-rc-navy"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** Person monogram — first letter of the first and last name. */
function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const letters =
    words.length >= 2
      ? [words[0][0], words[words.length - 1][0]]
      : [name.slice(0, 2)]
  return letters.join('').toUpperCase() || '?'
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white"
    >
      {initials(name)}
    </span>
  )
}

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={'text-white/70 transition-transform ' + className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
