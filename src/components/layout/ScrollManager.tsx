import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Scroll restoration for the SPA. BrowserRouter doesn't restore scroll, and the
 * browser's own `scrollRestoration` mis-fires for client-rendered content. So
 * we take manual control:
 *   • forward navigation (PUSH/REPLACE) starts at the top;
 *   • back/forward (POP) restores the position you left.
 *
 * Restoring is retried over ~1.5s because React-Query-cached list pages paint a
 * few frames after mount; we stop early once reached, or if the user scrolls.
 *
 * Temporarily instrumented with `[scroll]` console logs to diagnose a report of
 * lost scroll on back.
 */
const positions = new Map<string, number>()
const DEBUG = true

/** Current vertical scroll offset, whichever element is actually scrolling. */
function currentScroll(): number {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

export function ScrollManager() {
  const { key, pathname } = useLocation()
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
      if (DEBUG) console.log('[scroll]', navType, pathname, '→ top')
      window.scrollTo(0, 0)
      return
    }
    const target = positions.get(key) ?? 0
    if (DEBUG) console.log('[scroll] POP', pathname, 'key', key, 'target', target)
    if (target <= 0) {
      window.scrollTo(0, 0)
      return
    }

    let raf = 0
    let cancelled = false
    let attempts = 0
    const start = performance.now()
    const cancel = () => {
      cancelled = true
    }
    window.addEventListener('wheel', cancel, { passive: true, once: true })
    window.addEventListener('touchstart', cancel, { passive: true, once: true })

    const step = () => {
      if (cancelled) return
      attempts++
      window.scrollTo(0, target)
      const now = currentScroll()
      const reached = Math.abs(now - target) <= 2
      if (!reached && performance.now() - start < 1500) {
        raf = requestAnimationFrame(step)
      } else if (DEBUG) {
        console.log(
          '[scroll] restore end',
          reached ? 'reached' : 'gave-up',
          'at',
          now,
          '/',
          target,
          'docH',
          document.documentElement.scrollHeight,
          'winH',
          window.innerHeight,
          'attempts',
          attempts,
        )
      }
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
    }
  }, [key, navType, pathname])

  // Track the current entry's scroll position so POP can restore it.
  useEffect(() => {
    let lastLog = 0
    const save = () => {
      const y = currentScroll()
      positions.set(key, y)
      if (DEBUG && performance.now() - lastLog > 400) {
        lastLog = performance.now()
        console.log(
          '[scroll] save',
          pathname,
          'key',
          key,
          'win',
          window.scrollY,
          'docEl',
          document.documentElement.scrollTop,
          'body',
          document.body.scrollTop,
        )
      }
    }
    window.addEventListener('scroll', save, { passive: true })
    if (DEBUG) console.log('[scroll] listening on', pathname, 'key', key)
    return () => {
      save()
      window.removeEventListener('scroll', save)
    }
  }, [key, pathname])

  return null
}
