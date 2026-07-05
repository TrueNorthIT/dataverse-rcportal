import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { FlowDiagram } from './FlowDiagram'

/**
 * A controllable IntersectionObserver so a test can drive the diagram from its
 * pre-scroll state (no animation classes) to the built-in / streaming state.
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

describe('FlowDiagram', () => {
  it('exposes the accessible request-flow description on the desktop svg', () => {
    const svgRef = createRef<SVGSVGElement>()
    render(<FlowDiagram svgRef={svgRef} />)

    const svg = document.querySelector('svg[role="img"]') as SVGSVGElement
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('aria-label')).toBe(
      'React portal to Contact Portal API to Dataverse, authenticated by Entra External ID',
    )
  })

  it('attaches the forwarded ref to the exportable desktop svg', () => {
    const svgRef = createRef<SVGSVGElement>()
    render(<FlowDiagram svgRef={svgRef} />)

    expect(svgRef.current).toBeInstanceOf(SVGSVGElement)
    expect(svgRef.current?.getAttribute('role')).toBe('img')
    expect(svgRef.current?.getAttribute('viewBox')).toBe('0 0 960 184')
  })

  it('labels each node with its title and subtitle', () => {
    const svgRef = createRef<SVGSVGElement>()
    const { container } = render(<FlowDiagram svgRef={svgRef} />)
    const text = container.textContent ?? ''

    // Titles + subtitles appear once per layout (desktop + phone) = twice each.
    expect(text).toContain('React portal')
    expect(text).toContain('browser app')
    expect(text).toContain('Contact Portal API')
    expect(text).toContain('authorises + security-trims')
    expect(text).toContain('Dataverse')
    expect(text).toContain('your data')
  })

  it('renders both the desktop badges and the Entra authentication label', () => {
    const svgRef = createRef<SVGSVGElement>()
    const { container } = render(<FlowDiagram svgRef={svgRef} />)
    const text = container.textContent ?? ''

    expect(text).toContain('GENERIC · STATELESS · SECURE')
    expect(text).toContain('Authenticated by Entra External ID')
  })

  it('renders a desktop layout and a phone layout', () => {
    const svgRef = createRef<SVGSVGElement>()
    const { container } = render(<FlowDiagram svgRef={svgRef} />)

    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(2)

    // Desktop = role img (visible sm+); phone = aria-hidden (visible below sm).
    expect(container.querySelector('svg.hidden.sm\\:block[role="img"]')).toBeTruthy()
    const phone = container.querySelector('svg[aria-hidden="true"]')
    expect(phone).toBeTruthy()
    expect(phone?.getAttribute('viewBox')).toBe('0 0 360 380')
  })

  describe('before scrolling into view', () => {
    it('does not apply the build-in / packet animation classes', () => {
      const svgRef = createRef<SVGSVGElement>()
      // Global IntersectionObserver mock never fires -> inView stays false.
      const { container } = render(<FlowDiagram svgRef={svgRef} />)

      expect(container.querySelector('.rc-flowin')).toBeNull()
      expect(container.querySelector('.rc-dashmove')).toBeNull()
      expect(container.querySelector('.rc-flowdot')).toBeNull()
    })
  })

  describe('once scrolled into view', () => {
    beforeEach(() => {
      observers = []
      vi.stubGlobal('IntersectionObserver', FakeObserver)
    })
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('adds the build-in, dash-move and flowing-packet animation classes', () => {
      const svgRef = createRef<SVGSVGElement>()
      const { container } = render(<FlowDiagram svgRef={svgRef} />)

      act(() => observers.forEach((o) => o.fire([{ isIntersecting: true }])))

      expect(container.querySelectorAll('.rc-flowin').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('.rc-dashmove').length).toBe(2)
      expect(container.querySelectorAll('.rc-flowdot').length).toBe(2)
    })
  })
})
