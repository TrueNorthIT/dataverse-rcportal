import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

/** Core sections — the customer's own data (spec §6). */
const CORE = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/profile', label: 'My profile' },
  { to: '/company', label: 'My company' },
  { to: '/quotes', label: 'Quotes' },
  { to: '/projects', label: 'Projects' },
  { to: '/sites', label: 'Sites' },
  { to: '/cases', label: 'Support' },
]

/** Self-serve / help items, grouped under a "Help" menu to keep the bar tidy. */
const HELP = [
  { to: '/knowledge', label: 'Knowledge base' },
  { to: '/ai', label: 'AI assistant' },
  { to: '/feedback', label: 'Feedback' },
]

const tabClass = ({ isActive }: { isActive: boolean }) =>
  'whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ' +
  (isActive ? 'border-rc-blue text-rc-navy' : 'border-transparent text-rc-teal hover:text-rc-navy')

/** Horizontal section nav under the shell header: core tabs + a Help dropdown. */
export function NavTabs() {
  return (
    <nav className="border-b border-rc-blue-light bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-1 px-4">
        <div className="flex gap-1 overflow-x-auto">
          {CORE.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={tabClass}>
              {label}
            </NavLink>
          ))}
        </div>
        <HelpMenu />
      </div>
    </nav>
  )
}

/** "Help" dropdown holding the self-serve items (KB, AI, Feedback). */
function HelpMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const active = HELP.some((h) => pathname === h.to || pathname.startsWith(`${h.to}/`))

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          'inline-flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ' +
          (active ? 'border-rc-blue text-rc-navy' : 'border-transparent text-rc-teal hover:text-rc-navy')
        }
      >
        Help
        <svg
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 w-48 overflow-hidden rounded-b-xl border border-rc-blue-light bg-white shadow-lg"
        >
          {HELP.map((h) => (
            <NavLink
              key={h.to}
              to={h.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                'block px-4 py-2.5 text-sm transition-colors ' +
                (isActive
                  ? 'bg-rc-blue-light/50 font-medium text-rc-navy'
                  : 'text-rc-teal hover:bg-rc-blue-light/30 hover:text-rc-navy')
              }
            >
              {h.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
