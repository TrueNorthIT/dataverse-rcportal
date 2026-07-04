import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Scroll restoration for the SPA. BrowserRouter doesn't restore scroll, and the
 * browser's own `scrollRestoration` mis-fires for client-rendered content
 * (measures height before the list has painted). So we take manual control:
 *   • forward navigation (PUSH/REPLACE) starts at the top;
 *   • back/forward (POP) restores the position you left — returning from a case
 *     drops you back where you were in the (infinite-scrolling) list.
 *
 * Restoring is retried over ~1.5s because React-Query-cached list pages may
 * paint a few frames after mount (the page isn't tall enough to scroll back
 * to yet); we stop early once the target is reached, or if the user scrolls.
 */
const positions = new Map<string, number>()

export function ScrollManager() {
  const { key } = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return
    const prev = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = prev
    }
  }, [])

  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0)
      return
    }
    const target = positions.get(key) ?? 0
    if (target <= 0) {
      window.scrollTo(0, 0)
      return
    }

    let raf = 0
    let cancelled = false
    const start = performance.now()
    const cancel = () => {
      cancelled = true
    }
    // If the user grabs the page mid-restore, stop fighting them.
    window.addEventListener('wheel', cancel, { passive: true, once: true })
    window.addEventListener('touchstart', cancel, { passive: true, once: true })

    const step = () => {
      if (cancelled) return
      window.scrollTo(0, target)
      const reached = Math.abs(window.scrollY - target) <= 2
      if (!reached && performance.now() - start < 1500) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
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
