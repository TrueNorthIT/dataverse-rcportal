import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/render'
import DashboardCharts from './DashboardCharts'

/**
 * The four distribution charts and the delivery trend each fetch real
 * aggregates through their own data hooks; that behaviour is covered by their
 * own tests. Here we stub the children with light markers so we can assert
 * DashboardCharts' own job: composition, the props it hands each chart, and the
 * scroll-reveal wrappers.
 */
vi.mock('./DistributionDonut', () => ({
  DistributionDonut: (props: { title: string; table: string; area: string }) => (
    <div data-testid="donut" data-title={props.title} data-table={props.table} data-area={props.area}>
      {props.title}
    </div>
  ),
}))
vi.mock('./ConnectivityBars', () => ({
  ConnectivityBars: () => <div data-testid="connectivity">Sites by connectivity</div>,
}))
vi.mock('./DeliveryTrend', () => ({
  DeliveryTrend: () => <div data-testid="trend">Deliveries by month</div>,
}))

/**
 * A controllable IntersectionObserver so a test can drive the Reveal wrappers
 * from hidden (opacity-0) to unfolded. Mirrors the pattern in useInView.test.
 */
type IOEntryish = { isIntersecting: boolean }
let observers: FakeObserver[] = []
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
    observers.push(this)
  }
  fire(entries: IOEntryish[]) {
    this.callback(entries as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
  }
}

describe('DashboardCharts', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the "At a glance" section heading', () => {
    renderWithProviders(<DashboardCharts />)
    expect(screen.getByRole('heading', { name: 'At a glance' })).toBeInTheDocument()
  })

  it('renders all three distribution donuts with their table + area props', () => {
    renderWithProviders(<DashboardCharts />)
    const donuts = screen.getAllByTestId('donut')
    expect(donuts).toHaveLength(3)

    const byTitle = Object.fromEntries(donuts.map((d) => [d.getAttribute('data-title'), d]))
    expect(byTitle['Projects by health']?.getAttribute('data-table')).toBe('project')
    expect(byTitle['Projects by health']?.getAttribute('data-area')).toBe('/projects')
    expect(byTitle['Cases by priority']?.getAttribute('data-table')).toBe('case')
    expect(byTitle['Cases by priority']?.getAttribute('data-area')).toBe('/cases')
    expect(byTitle['Quotes by state']?.getAttribute('data-table')).toBe('quote')
    expect(byTitle['Quotes by state']?.getAttribute('data-area')).toBe('/quotes')
  })

  it('renders the connectivity bars and the delivery trend', () => {
    renderWithProviders(<DashboardCharts />)
    expect(screen.getByTestId('connectivity')).toBeInTheDocument()
    expect(screen.getByTestId('trend')).toBeInTheDocument()
  })

  it('wraps each chart in a hidden reveal until it scrolls into view', () => {
    // The global IntersectionObserver mock never fires, so nothing has entered
    // the viewport yet: every reveal wrapper stays opacity-0 (children present).
    const { container } = renderWithProviders(<DashboardCharts />)
    const hidden = container.querySelectorAll('.opacity-0')
    // four charts in the grid + the delivery trend = five reveal wrappers.
    expect(hidden).toHaveLength(5)
    expect(container.querySelector('.rc-unfold')).toBeNull()
  })

  describe('when scrolled into view', () => {
    beforeEach(() => {
      observers = []
      vi.stubGlobal('IntersectionObserver', FakeObserver)
    })
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('unfolds each reveal wrapper and staggers the delay by index', () => {
      const { container } = renderWithProviders(<DashboardCharts />)

      act(() => observers.forEach((o) => o.fire([{ isIntersecting: true }])))

      const unfolded = container.querySelectorAll('.rc-unfold')
      expect(unfolded).toHaveLength(5)
      expect(container.querySelector('.opacity-0')).toBeNull()

      // Reveal index 0 has no delay; the trend (index 4) is staggered to 360ms.
      const delays = Array.from(unfolded).map((el) => (el as HTMLElement).style.getPropertyValue('--rc-delay'))
      expect(delays).toContain('0ms')
      expect(delays).toContain('360ms')
    })
  })
})
