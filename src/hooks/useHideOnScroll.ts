import { useEffect, useRef, useState } from 'react'

/**
 * Hide-on-scroll-down / reveal-on-scroll-up for sticky chrome. Returns whether
 * the element should be hidden. Used to collapse the app header while scrolling
 * so content gets the full screen (especially on mobile); scroll up to bring it
 * back.
 *
 * Deliberately hard to trigger by accident: it always shows near the top, and
 * only flips after a sustained ~10px move (hysteresis). That stops layout
 * shifts — e.g. content reflowing after a company switch — from firing tiny
 * scroll events that would hide the header mid-tap and eat the first press.
 */
export function useHideOnScroll(threshold = 80): boolean {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY.current
        if (y < threshold) {
          setHidden(false) // always visible near the top
          lastY.current = y
        } else if (delta > 10) {
          setHidden(true) // deliberate scroll down
          lastY.current = y
        } else if (delta < -10) {
          setHidden(false) // deliberate scroll up
          lastY.current = y
        }
        // Smaller moves accumulate against lastY until they cross the threshold,
        // so jitter never flips the header.
        ticking.current = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return hidden
}
