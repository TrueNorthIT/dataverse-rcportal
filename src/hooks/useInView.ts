import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Reveal-on-scroll: returns a ref + whether the element has entered the
 * viewport. Latches true on first intersection (so it never re-hides), and
 * degrades to visible when IntersectionObserver is unavailable (SSR/old
 * browsers). Used to trigger the dashboard charts' unfold animation.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          obs.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [inView])

  return [ref, inView]
}
