import { NavLink } from 'react-router-dom'

/** Sections in nav order (spec §6). `end` on the dashboard so it isn't always active. */
const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/profile', label: 'My profile' },
  { to: '/company', label: 'My company' },
  { to: '/quotes', label: 'Quotes' },
  { to: '/projects', label: 'Projects' },
  { to: '/sites', label: 'Sites' },
  { to: '/cases', label: 'Support' },
]

/** Horizontal, scrollable section nav shown under the shell header. */
export function NavTabs() {
  return (
    <nav className="border-b border-rc-blue-light bg-white">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
        {NAV.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              'whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ' +
              (isActive
                ? 'border-rc-blue text-rc-navy'
                : 'border-transparent text-rc-teal hover:text-rc-navy')
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
