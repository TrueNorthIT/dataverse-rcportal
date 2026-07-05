import { useEffect, useRef, useState } from 'react'

/**
 * Hide-on-scroll-down / reveal-on-scroll-up for sticky chrome. Returns whether
 * the element should be hidden. Ignores sub-pixel jitter and always shows near
 * the very top. Used to collapse the app header while scrolling so content gets
 * the full screen (especially on mobile); scroll up a touch to bring it back.
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
        if (Math.abs(delta) > 6) {
          setHidden(delta > 0 && y > threshold)
          lastY.current = y
        }
        ticking.current = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return hidden
}
