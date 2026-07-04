import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Scroll restoration for the SPA. BrowserRouter doesn't restore scroll, and the
 * browser's own `scrollRestoration` mis-fires for client-rendered content, so
 * we take manual control:
 *   • forward navigation (PUSH/REPLACE) starts at the top;
 *   • back/forward (POP) restores the position you left — returning from a case
 *     drops you back where you were in the (infinite-scrolling) list.
 *
 * The subtle bit: when you leave a long list its DOM unmounts, the page
 * collapses to ~0 height, and the browser resets scrollY to 0 — firing one last
 * scroll event that would clobber the saved position with 0. So we only record
 * a position while the page is actually scrollable; the collapse is ignored and
 * the last real position survives.
 *
 * Restoring is retried over ~1.5s because React-Query-cached list pages paint a
 * few frames after mount; we stop early once reached, or if the user scrolls.
 */
const positions = new Map<string, number>()

/** Current vertical scroll offset, whichever element is actually scrolling. */
function currentScroll(): number {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

/** How far the page can scroll — 0 (or less) means it isn't scrollable now. */
function maxScroll(): number {
  return document.documentElement.scrollHeight - window.innerHeight
}

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
      const reached = Math.abs(currentScroll() - target) <= 2
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

  // Record the current entry's scroll position — but only while the page is
  // genuinely scrollable, so the height-collapse-to-0 on unmount can't clobber it.
  useEffect(() => {
    const save = () => {
      if (maxScroll() > 4) positions.set(key, currentScroll())
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      save()
      window.removeEventListener('scroll', save)
    }
  }, [key])

  return null
}
