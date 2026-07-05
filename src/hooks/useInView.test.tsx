import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useInView } from './useInView'

/**
 * A controllable IntersectionObserver: captures the callback the hook passes so a
 * test can drive intersection manually, and records disconnect/observe calls.
 */
type IOEntryish = { isIntersecting: boolean }
let lastObserver: FakeObserver | undefined

class FakeObserver {
  callback: IntersectionObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  scrollMargin = ''
  thresholds = []
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb
    // eslint-disable-next-line no-this-alias -- test double needs to expose the live instance
    lastObserver = this
  }
  fire(entries: IOEntryish[]) {
    this.callback(entries as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
  }
}

// A tiny probe component so we can render the hook against a real element ref.
function Probe() {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} data-testid="probe" data-in-view={inView}>
      {inView ? 'visible' : 'hidden'}
    </div>
  )
}

describe('useInView', () => {
  beforeEach(() => {
    lastObserver = undefined
    vi.stubGlobal('IntersectionObserver', FakeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('starts hidden and observes the element on mount', () => {
    const { getByTestId } = render(<Probe />)

    expect(getByTestId('probe')).toHaveTextContent('hidden')
    expect(lastObserver).toBeDefined()
    expect(lastObserver!.observe).toHaveBeenCalledTimes(1)
  })

  it('latches to visible on first intersection and disconnects', () => {
    const { getByTestId } = render(<Probe />)

    act(() => lastObserver!.fire([{ isIntersecting: true }]))

    expect(getByTestId('probe')).toHaveTextContent('visible')
    expect(lastObserver!.disconnect).toHaveBeenCalled()
  })

  it('ignores entries that are not intersecting', () => {
    const { getByTestId } = render(<Probe />)

    act(() => lastObserver!.fire([{ isIntersecting: false }]))

    expect(getByTestId('probe')).toHaveTextContent('hidden')
    expect(lastObserver!.disconnect).not.toHaveBeenCalled()
  })

  it('does not re-run the observer once already in view', () => {
    render(<Probe />)
    const first = lastObserver!

    act(() => first.fire([{ isIntersecting: true }]))
    // Effect re-runs on the inView change, but the early return means no new observer.
    expect(lastObserver).toBe(first)
    expect(first.observe).toHaveBeenCalledTimes(1)
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<Probe />)
    const obs = lastObserver!

    unmount()

    expect(obs.disconnect).toHaveBeenCalled()
  })

  it('degrades to visible when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    const { getByTestId } = render(<Probe />)

    expect(getByTestId('probe')).toHaveTextContent('visible')
  })
})
