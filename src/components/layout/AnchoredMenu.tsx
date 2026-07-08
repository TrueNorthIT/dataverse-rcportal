import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * A header dropdown panel, rendered through a portal to <body>.
 *
 * Why a portal: the app header is `sticky z-40`, and the dashboard pins its
 * scope toggle band ABOVE it (`z-50`) so the header can never cover the toggle
 * and eat a tap (see DashboardPage). A stacking context means anything rendered
 * *inside* the header — however high its own z-index — still paints underneath
 * that band, so the company-switcher / user menus opened from the header were
 * being overdrawn by the toggle. Escaping to <body> at z-[60] puts the open
 * menu above both, without giving up the toggle's tap-reliability fix.
 *
 * The panel is right-aligned to the anchor's rect and closes on outside press,
 * Escape, page scroll, or resize (the anchor is sticky chrome, so on scroll it
 * moves/hides — closing beats drifting). Scrolling *inside* the panel is fine:
 * `window` scroll doesn't fire for nested scrollers.
 */
export function AnchoredMenu({
  anchorRef,
  onClose,
  className = '',
  children,
}: {
  /** The wrapper around the trigger button — used to anchor and to ignore trigger presses. */
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  /** Sizing classes (width bounds etc.) — chrome classes are built in. */
  className?: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
  }, [anchorRef])

  useEffect(() => {
    // pointerdown (not mousedown): on touch, mousedown is synthesized late in
    // the gesture, which made the first press flaky. pointerdown fires reliably
    // at the start of any press, mouse or touch. Presses on the trigger are
    // ignored here so its own onClick can toggle the menu closed.
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [anchorRef, onClose])

  if (!pos) return null

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      style={{ top: pos.top, right: pos.right }}
      className={
        'fixed z-[60] overflow-hidden rounded-xl border border-rc-blue-light bg-white shadow-xl ' +
        className
      }
    >
      {children}
    </div>,
    document.body,
  )
}
