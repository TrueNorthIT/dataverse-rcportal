import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useFeedback } from '../common/FeedbackDialog'

/** Core sections — the customer's own data (spec §6). */
// "My profile" and "My company" are intentionally absent — they live in the
// header's UserMenu. Dashboard collapses to a home glyph on mobile (words on
// sm+) so the whole row fits a phone without sideways scrolling.
const CORE = [
  { to: '/', label: 'Dashboard', end: true, icon: true },
  { to: '/quotes', label: 'Quotes' },
  { to: '/projects', label: 'Projects' },
  { to: '/sites', label: 'Sites' },
  { to: '/cases', label: 'Support' },
]

/** Self-serve / help links, grouped under a "Help" menu to keep the bar tidy.
 * (Feedback isn't a route — it opens a dialog — so it's added separately.) */
const HELP = [
  { to: '/knowledge', label: 'Knowledge base' },
  { to: '/ai', label: 'AI assistant' },
]

const tabClass = ({ isActive }: { isActive: boolean }) =>
  'whitespace-nowrap border-b-2 px-2 py-3 text-sm font-medium transition-colors sm:px-3 ' +
  (isActive ? 'border-rc-blue text-rc-navy' : 'border-transparent text-rc-teal hover:text-rc-navy')

/** Horizontal section nav under the shell header: core tabs + a Help dropdown. */
export function NavTabs() {
  return (
    <nav className="border-b border-rc-blue-light bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4">
        {/* min-w-0 lets this shrink so its own overflow-x scrolls on mobile,
            instead of pushing the Help menu off-screen. */}
        <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto rc-noscrollbar sm:gap-1">
          {CORE.map(({ to, label, end, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={tabClass}
              aria-label={icon ? label : undefined}
              title={icon ? label : undefined}
            >
              {icon ? (
                <>
                  <HomeIcon className="sm:hidden" />
                  <span className="hidden sm:inline">{label}</span>
                </>
              ) : (
                label
              )}
            </NavLink>
          ))}
        </div>
        <HelpMenu />
      </div>
    </nav>
  )
}

/** Home glyph — the Dashboard tab's mobile face. */
function HomeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={'block ' + className}
    >
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1Z" />
    </svg>
  )
}

/** Circled question mark — the Help menu's mobile face. */
function HelpIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={'block ' + className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.2a2.8 2.8 0 1 1 3.9 2.9c-.8.3-1.2.9-1.2 1.7v.3" />
      <path d="M12 17.2h.01" />
    </svg>
  )
}

/** "Help" dropdown holding the self-serve items (KB, AI, Feedback). */
function HelpMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const feedback = useFeedback()
  const active = HELP.some((h) => pathname === h.to || pathname.startsWith(`${h.to}/`))
  const menuItemClass =
    'block w-full px-4 py-2.5 text-left text-sm text-rc-teal transition-colors hover:bg-rc-blue-light/30 hover:text-rc-navy'

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
        aria-label="Help"
        title="Help"
        className={
          'inline-flex items-center gap-1 whitespace-nowrap border-b-2 px-2 py-3 text-sm font-medium transition-colors sm:px-3 ' +
          (active ? 'border-rc-blue text-rc-navy' : 'border-transparent text-rc-teal hover:text-rc-navy')
        }
      >
        <HelpIcon className="sm:hidden" />
        <span className="hidden sm:inline">Help</span>
        {/* Chevron is a desktop nicety — dropped on mobile to help the row fit. */}
        <svg
          className={`hidden transition-transform sm:block ${open ? 'rotate-180' : ''}`}
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
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              feedback.open()
            }}
            className={menuItemClass}
          >
            Feedback
          </button>
        </div>
      )}
    </div>
  )
}
