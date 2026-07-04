import { useEffect, useState } from 'react'

/**
 * Floating "back to top" button — fades in once you've scrolled a screenful,
 * handy on the long infinite-scroll lists. Brand-gradient pill, bottom-right.
 */
export function ScrollToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!show) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="rc-gradient fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  )
}
