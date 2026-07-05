import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { ScrollManager } from './ScrollManager'

/**
 * ScrollManager owns SPA scroll restoration. It has no visible output (returns
 * null), so these tests drive real navigation inside a MemoryRouter and assert
 * on window.scrollTo / window.history.scrollRestoration side effects.
 */

// A tiny helper that navigates programmatically so we can produce PUSH and POP
// history entries the way the real router does.
function Nav({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace })
  }, [navigate, to, replace])
  return null
}

// Exposes navigate so a test can drive a real back/forward POP entry.
let doNavigate: ReturnType<typeof useNavigate>
function CaptureNavigate() {
  doNavigate = useNavigate()
  return null
}

function renderManager(ui?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<>{ui ?? null}</>} />
        <Route path="/list" element={<>list</>} />
        <Route path="/detail" element={<>detail</>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ScrollManager', () => {
  let scrollToSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scrollToSpy = vi.fn()
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo
    // Start each test with a clean, known scroll restoration setting.
    window.history.scrollRestoration = 'auto'
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing', () => {
    const { container } = renderManager()
    expect(container).toBeEmptyDOMElement()
  })

  it('takes manual control of scroll restoration on mount and restores it on unmount', () => {
    expect(window.history.scrollRestoration).toBe('auto')
    const { unmount } = renderManager()
    expect(window.history.scrollRestoration).toBe('manual')
    unmount()
    expect(window.history.scrollRestoration).toBe('auto')
  })

  it('scrolls to the top on forward (PUSH) navigation', () => {
    renderManager(<Nav to="/list" />)
    // Initial mount + the PUSH both reset to top.
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  it('scrolls to the top on a POP with no saved position', async () => {
    render(
      <MemoryRouter initialEntries={['/list', '/detail']} initialIndex={1}>
        <ScrollManager />
        <CaptureNavigate />
        <Routes>
          <Route path="/list" element={<>list</>} />
          <Route path="/detail" element={<>detail</>} />
        </Routes>
      </MemoryRouter>,
    )
    scrollToSpy.mockClear()
    // Go back — a POP with nothing saved for the target key -> reset to top.
    await act(async () => {
      doNavigate(-1)
    })
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  it('ignores a save while the page is not scrollable (mid-collapse)', () => {
    // Page is not scrollable: maxScroll() <= 4, so save() bails at the first guard.
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 700,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    renderManager()

    Object.defineProperty(window, 'scrollY', { value: 300, writable: true, configurable: true })
    // Fires the save path but the not-scrollable guard skips recording — no throw.
    window.dispatchEvent(new Event('scroll'))

    expect(scrollToSpy).toHaveBeenCalled()
  })

  it('does not overwrite a real saved position with an abrupt collapse-to-zero', async () => {
    // Scrollable page so positions get recorded.
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 5000,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    // Deterministic, self-stopping restore loop.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(performance, 'now').mockReturnValue(0)
    scrollToSpy.mockImplementation((_x: unknown, y: number) => {
      Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
    })

    render(
      <MemoryRouter initialEntries={['/list', '/detail']} initialIndex={1}>
        <ScrollManager />
        <CaptureNavigate />
        <Routes>
          <Route path="/list" element={<>list</>} />
          <Route path="/detail" element={<>detail</>} />
        </Routes>
      </MemoryRouter>,
    )

    // Record a screenful+ position for /detail.
    Object.defineProperty(window, 'scrollY', { value: 1600, writable: true, configurable: true })
    window.dispatchEvent(new Event('scroll'))

    // The collapse: still technically scrollable, but scrollY snaps to 0. The
    // second guard (y === 0 && saved > innerHeight) preserves the real position.
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
    window.dispatchEvent(new Event('scroll'))

    // Leave and return (POP) — the preserved 1600 is restored, not a clobbered 0.
    await act(async () => {
      doNavigate(-1)
    })
    await act(async () => {
      doNavigate(1)
    })
    expect(scrollToSpy).toHaveBeenCalledWith(0, 1600)
  })

  it('restores a saved position via the animation-frame loop on POP', async () => {
    // Page is scrollable so positions actually get recorded.
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 5000,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    // Drive requestAnimationFrame synchronously so the restore loop runs here.
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0)
        return 1
      })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    // Keep performance.now inside the 1500ms budget so the loop attempts a scroll.
    vi.spyOn(performance, 'now').mockReturnValue(0)
    // scrollTo should make currentScroll() report the target so `reached` is true
    // and the loop stops after one frame.
    scrollToSpy.mockImplementation((_x: unknown, y: number) => {
      Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
    })

    render(
      <MemoryRouter initialEntries={['/list', '/detail']} initialIndex={1}>
        <ScrollManager />
        <CaptureNavigate />
        <Routes>
          <Route path="/list" element={<>list</>} />
          <Route path="/detail" element={<>detail</>} />
        </Routes>
      </MemoryRouter>,
    )

    // Record a screenful+ position for the /detail entry.
    Object.defineProperty(window, 'scrollY', { value: 1600, writable: true, configurable: true })
    window.dispatchEvent(new Event('scroll'))

    // Back to /list (POP, no saved position -> top), then forward to /detail
    // (also a POP; its saved position is restored via the RAF loop).
    await act(async () => {
      doNavigate(-1)
    })
    await act(async () => {
      doNavigate(1)
    })

    // The restore loop asked the window to scroll to the saved target.
    expect(scrollToSpy).toHaveBeenCalledWith(0, 1600)
    expect(rafSpy).toHaveBeenCalled()
  })

  it('stops restoring when the user grabs the page mid-restore (wheel cancels)', async () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 5000,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    // Capture the scheduled step so we can run it *after* a cancel is fired,
    // proving the loop bails out (line: `if (cancelled) return`).
    let pendingStep: FrameRequestCallback | null = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      pendingStep = cb
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(performance, 'now').mockReturnValue(0)

    render(
      <MemoryRouter initialEntries={['/list', '/detail']} initialIndex={1}>
        <ScrollManager />
        <CaptureNavigate />
        <Routes>
          <Route path="/list" element={<>list</>} />
          <Route path="/detail" element={<>detail</>} />
        </Routes>
      </MemoryRouter>,
    )

    // Save a position for /detail, leave, then return (POP) to start the loop.
    Object.defineProperty(window, 'scrollY', { value: 1600, writable: true, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    await act(async () => {
      doNavigate(-1)
    })
    await act(async () => {
      doNavigate(1)
    })

    scrollToSpy.mockClear()
    // User grabs the page: the wheel `cancel` listener flips `cancelled`.
    await act(async () => {
      window.dispatchEvent(new Event('wheel'))
    })
    // Running the pending step now must bail immediately without scrolling.
    await act(async () => {
      pendingStep?.(0)
    })
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it('is a no-op when scrollRestoration is unsupported', () => {
    const original = window.history.scrollRestoration
    // Remove the property so `'scrollRestoration' in window.history` is false.
    // @ts-expect-error deliberately deleting an optional history feature for the test
    delete window.history.scrollRestoration
    expect('scrollRestoration' in window.history).toBe(false)

    const { unmount } = renderManager()
    // Still renders and unmounts without touching the missing feature.
    unmount()

    window.history.scrollRestoration = original
  })
})
