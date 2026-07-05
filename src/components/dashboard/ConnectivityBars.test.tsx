import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Children, cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/render'
import { ConnectivityBars } from './ConnectivityBars'

// Data hook mocked: a test declares the count per connectivity pill (keyed by
// the connectivity label, per buildSitePills()).
let counts: Record<string, number | null>
vi.mock('../../hooks/usePillCounts', () => ({
  usePillCounts: () => counts,
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

// recharts stand-ins: render the bar rows (label + value) and expose the bar
// click handler so its deep-link + guard branches are driven deterministically.
// Recharts injects the chart `data` into its Bar child, so the mocked BarChart
// clones that data onto <Bar>, matching the real contract.
type Datum = { key: string; label: string; value: number }
interface BarProps {
  data?: Datum[]
  onClick?: (d: unknown) => void
  children?: ReactNode
}
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children, data }: { children: ReactNode; data: Datum[] }) => (
    <div>
      {/* Emit the axis labels + value labels the real YAxis/LabelList would. */}
      {data.map((d) => (
        <div key={d.key}>
          <span>{d.label}</span>
          <span data-testid={`value-${d.key}`}>{d.value}</span>
        </div>
      ))}
      {Children.map(children, (child) =>
        isValidElement(child) ? cloneElement(child as ReactElement<BarProps>, { data }) : child,
      )}
    </div>
  ),
  XAxis: () => null,
  YAxis: () => null,
  LabelList: () => null,
  Cell: () => null,
  Bar: ({ data = [], onClick }: BarProps) => (
    <div>
      {data.map((d) => (
        <button key={d.key} data-testid={`bar-${d.key}`} onClick={() => onClick?.({ key: d.key })}>
          bar {d.label}
        </button>
      ))}
      {/* A datum with no key exercises the `if (key)` guard's false branch. */}
      <button data-testid="bar-nokey" onClick={() => onClick?.({})}>
        no key
      </button>
    </div>
  ),
}))

describe('ConnectivityBars', () => {
  beforeEach(() => {
    counts = {}
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the skeleton before the counts have loaded', () => {
    counts = {}
    renderWithProviders(<ConnectivityBars />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sites by connectivity' })).toBeInTheDocument()
  })

  it('shows the empty state when all connectivity counts are zero', () => {
    counts = { FTTP: 0, FTTC: 0, 'Leased Line': 0, 'Dark Fibre': 0, EFM: 0 }
    renderWithProviders(<ConnectivityBars />)
    expect(screen.getByText('Nothing to chart yet.')).toBeInTheDocument()
  })

  it('renders a bar with a label and value per connectivity type', () => {
    counts = { FTTP: 12, FTTC: 3, 'Leased Line': 1, 'Dark Fibre': 0, EFM: 4 }
    renderWithProviders(<ConnectivityBars />)

    expect(screen.getByText('FTTP')).toBeInTheDocument()
    expect(screen.getByText('Leased Line')).toBeInTheDocument()
    expect(screen.getByTestId('value-FTTP')).toHaveTextContent('12')
    expect(screen.getByTestId('value-EFM')).toHaveTextContent('4')
    // Missing count defaults to 0.
    expect(screen.getByTestId('value-Dark Fibre')).toHaveTextContent('0')
  })

  it('deep-links to the filtered sites list when a bar is clicked', async () => {
    const user = userEvent.setup()
    counts = { FTTP: 12 }
    renderWithProviders(<ConnectivityBars />)

    await user.click(screen.getByTestId('bar-FTTP'))
    expect(navigate).toHaveBeenCalledWith('/sites?f=FTTP')
  })

  it('url-encodes multi-word connectivity keys in the deep link', async () => {
    const user = userEvent.setup()
    counts = { 'Leased Line': 5 }
    renderWithProviders(<ConnectivityBars />)

    await user.click(screen.getByTestId('bar-Leased Line'))
    expect(navigate).toHaveBeenCalledWith('/sites?f=Leased%20Line')
  })

  it('ignores a bar click that carries no key', async () => {
    const user = userEvent.setup()
    counts = { FTTP: 12 }
    renderWithProviders(<ConnectivityBars />)

    await user.click(screen.getByTestId('bar-nokey'))
    expect(navigate).not.toHaveBeenCalled()
  })
})
