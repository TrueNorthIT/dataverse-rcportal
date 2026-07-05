import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/render'
import type { TrendPoint } from '../../hooks/useDeliveryTrend'
import { DeliveryTrend } from './DeliveryTrend'

// Mock the data hook so a test just says what the trend looks like.
let trend: { data: TrendPoint[]; loading: boolean }
vi.mock('../../hooks/useDeliveryTrend', () => ({
  useDeliveryTrend: () => trend,
}))

// recharts stand-ins. The X axis labels + <Tooltip> content need chart geometry
// jsdom can't compute, so the mock emits the month labels from the chart data
// and renders the Tooltip's `content` element with injected props — exercising
// the TrendTip renderer directly.
let tooltipProps: Record<string, unknown> | null = null
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children, data }: { children: ReactNode; data: TrendPoint[] }) => (
    <svg>
      {data.map((d) => (
        <text key={d.label}>{d.label}</text>
      ))}
      {children}
    </svg>
  ),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: ({ content }: { content?: ReactElement }) => {
    if (tooltipProps && content && isValidElement(content)) {
      return cloneElement(content, tooltipProps)
    }
    return null
  },
}))

const SAMPLE: TrendPoint[] = [
  { label: 'May', delivered: 1, projected: null },
  { label: 'Jun', delivered: 2, projected: null },
  { label: 'Jul', delivered: 2, projected: 2 },
  { label: 'Aug', delivered: null, projected: 3 },
]

describe('DeliveryTrend', () => {
  beforeEach(() => {
    tooltipProps = null
    trend = { data: [], loading: false }
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the loading skeleton while the trend is fetching', () => {
    trend = { data: [], loading: true }
    render(<DeliveryTrend />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Deliveries by month' })).toBeInTheDocument()
  })

  it('shows the empty state when there is no delivery history', () => {
    trend = { data: [], loading: false }
    render(<DeliveryTrend />)
    expect(screen.getByText('No delivery history yet.')).toBeInTheDocument()
  })

  it('treats an all-zero trend as empty', () => {
    trend = {
      data: [
        { label: 'May', delivered: 0, projected: null },
        { label: 'Jun', delivered: null, projected: 0 },
      ],
      loading: false,
    }
    render(<DeliveryTrend />)
    expect(screen.getByText('No delivery history yet.')).toBeInTheDocument()
  })

  it('treats a point where both series are null as contributing nothing', () => {
    // delivered null -> falls through to projected; projected null -> 0.
    trend = {
      data: [
        { label: 'May', delivered: null, projected: null },
        { label: 'Jun', delivered: null, projected: null },
      ],
      loading: false,
    }
    render(<DeliveryTrend />)
    expect(screen.getByText('No delivery history yet.')).toBeInTheDocument()
  })

  it('renders the chart with axis labels once there is data', () => {
    trend = { data: SAMPLE, loading: false }
    const { container } = render(<DeliveryTrend />)

    expect(screen.queryByText('No delivery history yet.')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
    // recharts renders an SVG chart surface.
    expect(container.querySelector('svg')).toBeInTheDocument()
    // Month labels appear on the X axis.
    expect(screen.getByText('Jul')).toBeInTheDocument()
  })

  describe('TrendTip (via the chart tooltip)', () => {
    it('renders the delivered figure for a delivered point', () => {
      trend = { data: SAMPLE, loading: false }
      tooltipProps = {
        active: true,
        label: 'Jun',
        payload: [{ dataKey: 'delivered', value: 2 }],
      }
      render(<DeliveryTrend />)
      expect(screen.getByText('2 delivered')).toBeInTheDocument()
    })

    it('renders the projected figure for a projected point', () => {
      trend = { data: SAMPLE, loading: false }
      tooltipProps = {
        active: true,
        label: 'Aug',
        payload: [{ dataKey: 'projected', value: 3 }],
      }
      render(<DeliveryTrend />)
      expect(screen.getByText('3 projected')).toBeInTheDocument()
    })

    it('renders nothing when the tooltip is inactive', () => {
      trend = { data: SAMPLE, loading: false }
      tooltipProps = { active: false, payload: [{ dataKey: 'delivered', value: 2 }] }
      const { container } = render(<DeliveryTrend />)
      expect(container.textContent).not.toContain('delivered')
    })

    it('renders nothing when the payload is empty', () => {
      trend = { data: SAMPLE, loading: false }
      tooltipProps = { active: true, payload: [], label: 'Jun' }
      render(<DeliveryTrend />)
      expect(screen.queryByText(/delivered|projected/)).not.toBeInTheDocument()
    })

    it('renders nothing when no payload point carries a numeric value', () => {
      trend = { data: SAMPLE, loading: false }
      tooltipProps = { active: true, payload: [{ dataKey: 'delivered' }], label: 'Jun' }
      render(<DeliveryTrend />)
      expect(screen.queryByText(/delivered|projected/)).not.toBeInTheDocument()
    })
  })

  it('renders inside the app providers without error', () => {
    trend = { data: SAMPLE, loading: false }
    renderWithProviders(<DeliveryTrend />)
    expect(screen.getByRole('heading', { name: 'Deliveries by month' })).toBeInTheDocument()
  })
})
