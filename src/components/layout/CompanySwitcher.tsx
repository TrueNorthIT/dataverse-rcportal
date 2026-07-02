import { useEffect, useRef, useState } from 'react'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'

/**
 * Company switcher for users who are a contact under more than one company.
 *
 * Renders nothing for the common single-company case. Otherwise it's a compact
 * "company chip" (building icon + current company + chevron) that opens a
 * branded popover menu; picking a company sends its contact id into
 * `useDataverseClient()` as the `X-Contact-Id` header so every request acts as
 * that company. Closes on outside-click or Escape.
 */
export function CompanySwitcher() {
  const { companies, hasMultiple, currentCompany, selectCompany } = useSelectedCompany()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!hasMultiple) return null

  const label = (c: typeof currentCompany) => c?.companyName ?? c?.fullname ?? 'Select company'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-rc-blue-light bg-white py-1.5 pl-1.5 pr-2.5 text-sm transition-colors hover:border-rc-blue hover:bg-rc-canvas"
      >
        <CompanyAvatar name={label(currentCompany)} />
        <span className="hidden max-w-[240px] truncate font-semibold text-rc-navy sm:inline">
          {label(currentCompany)}
        </span>
        <Chevron className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-max min-w-[16rem] max-w-[26rem] overflow-hidden rounded-xl border border-rc-blue-light bg-white shadow-xl"
        >
          <div className="rc-gradient h-1 w-full" />
          <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-rc-teal">
            Switch company
          </div>
          <ul className="max-h-80 overflow-y-auto pb-1">
            {companies.map((c) => {
              const active = c.contactid === currentCompany?.contactid
              return (
                <li key={c.contactid}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      selectCompany(c.contactid)
                      setOpen(false)
                    }}
                    className={
                      'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-rc-blue-light ' +
                      (active ? 'bg-rc-blue-light/60' : '')
                    }
                  >
                    <CompanyAvatar name={label(c)} small />
                    <span className="flex-1 font-medium text-rc-navy">{label(c)}</span>
                    {active && <Check />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// Brand-aligned monogram palette. Each company gets a stable colour + its
// initials — a tidy stand-in "logo" (think Slack/Workspace avatars), no janky
// clip-art. bg from the brand palette; fg chosen for contrast.
const AVATAR_COLORS = [
  { bg: '#0066b3', fg: '#ffffff' }, // rc-blue
  { bg: '#005862', fg: '#ffffff' }, // rc-teal
  { bg: '#142d46', fg: '#ffffff' }, // rc-navy
  { bg: '#00272b', fg: '#ffffff' }, // rc-green-dark
  { bg: '#8dc63f', fg: '#142d46' }, // rc-lime (navy text for contrast)
]
const STOPWORDS = new Set(['ltd', 'plc', 'group', 'the', 'and', '&', 'co', 'limited'])

/** Up to two initials from the significant words of a company name. */
function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase().replace(/[.,]/g, '')))
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '')
  return (letters.join('') || name.slice(0, 2).toUpperCase()) || '?'
}

/** Stable palette index from the name (so a company's colour never changes). */
function colorFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** Per-company monogram avatar — the switcher's "logo". */
function CompanyAvatar({ name, small }: { name: string; small?: boolean }) {
  const { bg, fg } = colorFor(name)
  return (
    <span
      aria-hidden="true"
      className={
        'inline-flex shrink-0 items-center justify-center rounded-md font-bold ' +
        (small ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]')
      }
      style={{ backgroundColor: bg, color: fg }}
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
      className={'text-rc-teal transition-transform ' + className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-rc-blue">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
