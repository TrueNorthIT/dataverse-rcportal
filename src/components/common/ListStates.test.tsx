import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListStates, LoadMore } from './ListStates'

describe('ListStates', () => {
  it('shows the loading skeleton on first load (loading + empty)', () => {
    const { container } = render(
      <ListStates loading error={null} isEmpty>
        <div>rows</div>
      </ListStates>,
    )

    const skeleton = screen.getByLabelText('Loading')
    expect(skeleton).toHaveAttribute('aria-busy', 'true')
    // Four staggered skeleton rows, and no children yet.
    expect(container.querySelectorAll('.rc-skeleton').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByText('rows')).not.toBeInTheDocument()
  })

  it('renders the error box when there is an error and no data yet', () => {
    render(
      <ListStates loading={false} error="Something broke" isEmpty>
        <div>rows</div>
      </ListStates>,
    )

    expect(screen.getByText('Something broke')).toBeInTheDocument()
    expect(screen.queryByText('rows')).not.toBeInTheDocument()
  })

  it('renders the default empty message when there is nothing to show', () => {
    render(
      <ListStates loading={false} error={null} isEmpty>
        <div>rows</div>
      </ListStates>,
    )

    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument()
    expect(screen.queryByText('rows')).not.toBeInTheDocument()
  })

  it('renders a custom empty message when provided', () => {
    render(
      <ListStates loading={false} error={null} isEmpty emptyMessage="No cases open">
        <div>rows</div>
      </ListStates>,
    )

    expect(screen.getByText('No cases open')).toBeInTheDocument()
  })

  it('renders children when there is content and no refetch in flight', () => {
    const { container } = render(
      <ListStates loading={false} error={null} isEmpty={false}>
        <div>rows</div>
      </ListStates>,
    )

    expect(screen.getByText('rows')).toBeInTheDocument()
    // Not busy, no progress bar, content fully opaque.
    const wrapper = container.firstElementChild
    expect(wrapper).toHaveAttribute('aria-busy', 'false')
    expect(container.querySelector('.rc-progress')).toBeNull()
    expect(container.querySelector('.opacity-100')).not.toBeNull()
  })

  it('keeps content mounted and dims it while revalidating (loading + has data)', () => {
    const { container } = render(
      <ListStates loading error={null} isEmpty={false}>
        <div>rows</div>
      </ListStates>,
    )

    // Content stays on screen (no skeleton) during a keep-previous-data refetch.
    expect(screen.getByText('rows')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
    const wrapper = container.firstElementChild
    expect(wrapper).toHaveAttribute('aria-busy', 'true')
    // The slim indeterminate progress bar is shown and the list dims.
    expect(container.querySelector('.rc-progress')).not.toBeNull()
    expect(container.querySelector('.opacity-60')).not.toBeNull()
  })

  it('prefers the error box over the empty box when both apply', () => {
    render(
      <ListStates loading={false} error="Failed" isEmpty>
        <div>rows</div>
      </ListStates>,
    )

    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.queryByText('Nothing to show yet.')).not.toBeInTheDocument()
  })
})

describe('LoadMore', () => {
  // Capture the IntersectionObserver callback so a test can simulate the
  // sentinel scrolling into view without a real viewport.
  let ioCallback: IntersectionObserverCallback | undefined
  let observe: ReturnType<typeof vi.fn>
  let disconnect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    observe = vi.fn()
    disconnect = vi.fn()
    ioCallback = undefined
    class MockIO {
      constructor(cb: IntersectionObserverCallback) {
        ioCallback = cb
      }
      observe = observe
      disconnect = disconnect
      unobserve = vi.fn()
      takeRecords = vi.fn()
      root = null
      rootMargin = ''
      thresholds = []
    }
    vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when there is no more to load and nothing loading', () => {
    const { container } = render(<LoadMore hasMore={false} loading={false} onClick={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the "Loading more" indicator while a next page is in flight', () => {
    render(<LoadMore hasMore loading onClick={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading more')
  })

  it('observes the sentinel and fires onClick when it scrolls into view', () => {
    const onClick = vi.fn()
    render(<LoadMore hasMore loading={false} onClick={onClick} />)

    expect(observe).toHaveBeenCalledTimes(1)
    // Simulate the sentinel entering the viewport.
    ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick while a page is already loading', () => {
    const onClick = vi.fn()
    render(<LoadMore hasMore loading onClick={onClick} />)

    ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not fire onClick when the sentinel is not intersecting', () => {
    const onClick = vi.fn()
    render(<LoadMore hasMore loading={false} onClick={onClick} />)

    ioCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not observe (or render a sentinel) when there is no more to load', () => {
    // hasMore=false but loading=true still renders the indicator, but the effect
    // early-returns so nothing is observed.
    render(<LoadMore hasMore={false} loading onClick={vi.fn()} />)
    expect(observe).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Loading more')
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<LoadMore hasMore loading={false} onClick={vi.fn()} />)
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
