import { useLocation, useNavigate } from 'react-router-dom'

/** Navigation context passed from a list row: ordered ids, origin, and tier. */
export interface ListNavState {
  ids?: string[]
  from?: string
  tier?: 'me' | 'team'
}

/**
 * Shared prev/next + back behaviour for detail pages (extracted from the case
 * detail pattern). Given the base list path (e.g. `/quotes`) and the current
 * id, it reads the `location.state` a list row passed and returns the ids to
 * step to plus navigation helpers.
 *
 * Stepping uses `replace` so history stays list → detail; Back then returns to
 * the list (and its scroll) rather than walking prior records.
 */
export function useListNav(basePath: string, id: string | undefined) {
  const navigate = useNavigate()
  const location = useLocation()
  const nav = (location.state ?? {}) as ListNavState

  const idx = id && nav.ids ? nav.ids.indexOf(id) : -1
  const prevId = idx > 0 ? nav.ids![idx - 1] : undefined
  const nextId = idx >= 0 && nav.ids && idx < nav.ids.length - 1 ? nav.ids[idx + 1] : undefined

  const goTo = (target: string) => navigate(`${basePath}/${target}`, { replace: true, state: nav })
  const goBack = () => (nav.from ? navigate(-1) : navigate(basePath))

  return {
    tier: nav.tier,
    prevId,
    nextId,
    goPrev: () => prevId && goTo(prevId),
    goNext: () => nextId && goTo(nextId),
    goBack,
  }
}
