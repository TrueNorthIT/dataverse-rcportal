import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useHideOnScroll } from './useHideOnScroll'

/** Set window.scrollY and dispatch a scroll event as the browser would. */
function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

describe('useHideOnScroll', () => {
  beforeEach(() => {
    // Run rAF callbacks synchronously so each scroll event settles immediately.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts visible (not hidden)', () => {
    const { result } = renderHook(() => useHideOnScroll())
    expect(result.current).toBe(false)
  })

  it('hides after a deliberate scroll down past the threshold', () => {
    const { result } = renderHook(() => useHideOnScroll(80))

    scrollTo(200)

    expect(result.current).toBe(true)
  })

  it('reveals again on a deliberate scroll up', () => {
    const { result } = renderHook(() => useHideOnScroll(80))

    scrollTo(200)
    expect(result.current).toBe(true)

    scrollTo(150) // moved up 50px (delta < -10)
    expect(result.current).toBe(false)
  })

  it('always shows near the top regardless of prior state', () => {
    const { result } = renderHook(() => useHideOnScroll(80))

    scrollTo(200)
    expect(result.current).toBe(true)

    scrollTo(40) // below the 80px threshold
    expect(result.current).toBe(false)
  })

  it('ignores small jittery moves below the 10px hysteresis', () => {
    const { result } = renderHook(() => useHideOnScroll(80))

    scrollTo(100) // above threshold but delta from 0 is +100 -> hides
    expect(result.current).toBe(true)

    // Now nudge up by only 5px: delta -5 is within hysteresis, no change.
    scrollTo(95)
    expect(result.current).toBe(true)
  })

  it('coalesces scroll events while a frame is pending (ticking guard)', () => {
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 0) // never invoke the callback -> stays "ticking"

    renderHook(() => useHideOnScroll(80))

    scrollTo(200)
    scrollTo(300)
    scrollTo(400)

    // Only the first scroll scheduled a frame; the rest were swallowed by the guard.
    expect(raf).toHaveBeenCalledTimes(1)
  })

  it('respects a custom threshold', () => {
    const { result } = renderHook(() => useHideOnScroll(500))

    scrollTo(300) // above 10px delta but below the 500 threshold -> still shown
    expect(result.current).toBe(false)

    scrollTo(600) // now past the custom threshold and scrolling down
    expect(result.current).toBe(true)
  })

  it('removes the scroll listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useHideOnScroll())

    unmount()

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
