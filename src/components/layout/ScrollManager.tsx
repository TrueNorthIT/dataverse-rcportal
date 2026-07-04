import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Scroll restoration for the SPA. BrowserRouter doesn't restore scroll, so:
 *   • forward navigation (PUSH/REPLACE) starts at the top;
 *   • back/forward (POP) restores the position you left — so returning from a
 *     case detail drops you back where you were in the (infinite-scrolling) list.
 *
 * Positions are keyed by the history entry's `location.key`. On POP we retry
 * over a few frames because list content (React-Query-cached pages) may paint a
 * tick after mount — otherwise the page isn't tall enough to scroll back yet.
 */
const positions = new Map<string, number>()

export function ScrollManager() {
  const { key } = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    if (navType === 'POP') {
      const target = positions.get(key) ?? 0
      let frames = 0
      const restore = () => {
        window.scrollTo(0, target)
        if (target > 0 && window.scrollY < target - 1 && frames++ < 20) {
          requestAnimationFrame(restore)
        }
      }
      requestAnimationFrame(restore)
    } else {
      window.scrollTo(0, 0)
    }
  }, [key, navType])

  // Track the current entry's scroll position so POP can restore it.
  useEffect(() => {
    const save = () => positions.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      save()
      window.removeEventListener('scroll', save)
    }
  }, [key])

  return null
}
