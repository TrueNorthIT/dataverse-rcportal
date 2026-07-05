import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/render'
import type { Pill } from '../../services/pills'
import { DistributionDonut } from './DistributionDonut'

// Data hook is mocked so a test just declares the per-pill counts.
let counts: Record<string, number | null>
vi.mock('../../hooks/usePillCounts', () => ({
  usePillCounts: () => counts,
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

// Render recharts' Pie as clickable stand-ins for each slice so we can drive the
// slice-click handler (and its out-of-range guard) deterministically, without
// depending on SVG hit geometry jsdom can't compute.
interface PieProps {
  data: { key: string; label: string }[]
  onClick?: (e: unknown, i: number) => void
  children?: ReactNode
}
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Pie: ({ data, onClick, children }: PieProps) => (
    <div>
      {data.map((d, i) => (
        // Neutral aria-label so slice buttons don't collide with legend rows.
        <button key={d.key} data-testid={`slice-${d.key}`} aria-label={`slice ${d.key}`} onClick={() => onClick?.(null, i)} />
      ))}
      {/* An out-of-range index to exercise the `if (s)` miss branch. */}
      <button data-testid="slice-phantom" aria-label="slice phantom" onClick={() => onClick?.(null, data.length)} />
      {children}
    </div>
  ),
}))

const PILLS: Pill[] = [
  { key: 'all', label: 'All' },
  { key: 'ontrack', label: 'On track', filter: { field: 's', operator: 'eq', value: 1 } },
  { key: 'overdue', label: 'Overdue', filter: { field: 's', operator: 'eq', value: 2 } },
  { key: 'complete', label: 'Complete', filter: { field: 's', operator: 'eq', value: 3 } },
]
const COLORS: Record<string, string> = {
  ontrack: '#1c6b4f',
  overdue: '#ef4444',
  // 'complete' deliberately omitted to exercise the default-colour fallback.
}

function renderDonut() {
  return renderWithProviders(
    <DistributionDonut
      title="Projects by health"
      icon="briefcase"
      table="project"
      area="/projects"
      pills={PILLS}
      colors={COLORS}
    />,
  )
}

describe('DistributionDonut', () => {
  beforeEach(() => {
    counts = {}
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the skeleton before the counts have loaded', () => {
    counts = {}
    renderDonut()
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projects by health' })).toBeInTheDocument()
  })

  it('shows the empty state when the counts load but total is zero', () => {
    counts = { ontrack: 0, overdue: 0, complete: 0 }
    renderDonut()
    expect(screen.getByText('Nothing to chart yet.')).toBeInTheDocument()
  })

  it('renders the total and a legend row per filter pill', () => {
    counts = { ontrack: 3, overdue: 2, complete: 5 }
    renderDonut()

    // Centre total = sum of the segments.
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('total')).toBeInTheDocument()

    // The non-filter "all" pill never appears; each filter pill does.
    expect(screen.getByText('On track')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.queryByText('All')).not.toBeInTheDocument()
  })

  it('deep-links to the filtered list when a legend row is clicked', async () => {
    const user = userEvent.setup()
    counts = { ontrack: 3, overdue: 2, complete: 5 }
    renderDonut()

    await user.click(screen.getByRole('button', { name: /On track/ }))
    expect(navigate).toHaveBeenCalledWith('/projects?f=ontrack')
  })

  it('url-encodes the pill key in the deep link', async () => {
    const user = userEvent.setup()
    const pills: Pill[] = [
      { key: 'all', label: 'All' },
      { key: 'Leased Line', label: 'Leased Line', filter: { field: 's', operator: 'eq', value: 1 } },
    ]
    counts = { 'Leased Line': 4 }
    renderWithProviders(
      <DistributionDonut
        title="X"
        icon="briefcase"
        table="site"
        area="/sites"
        pills={pills}
        colors={{}}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Leased Line/ }))
    expect(navigate).toHaveBeenCalledWith('/sites?f=Leased%20Line')
  })

  it('disables the legend row for a zero-count pill', async () => {
    const user = userEvent.setup()
    counts = { ontrack: 3, overdue: 0, complete: 5 }
    renderDonut()

    const overdueRow = screen.getByRole('button', { name: /Overdue/ })
    expect(overdueRow).toBeDisabled()
    await user.click(overdueRow)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('navigates when a donut slice is clicked', async () => {
    const user = userEvent.setup()
    counts = { ontrack: 3, overdue: 2, complete: 5 }
    renderDonut()

    // Only slices with a value > 0 render; click the first (ontrack).
    await user.click(screen.getByTestId('slice-ontrack'))
    expect(navigate).toHaveBeenCalledWith('/projects?f=ontrack')
  })

  it('ignores a slice click that resolves to no segment', async () => {
    const user = userEvent.setup()
    counts = { ontrack: 3, overdue: 2, complete: 5 }
    renderDonut()

    await user.click(screen.getByTestId('slice-phantom'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('falls back to the neutral slate colour for a pill with no mapped colour', () => {
    counts = { ontrack: 3, overdue: 2, complete: 5 }
    renderDonut()

    // 'complete' has no entry in COLORS -> its legend swatch uses the fallback.
    const completeRow = screen.getByRole('button', { name: /Complete/ })
    const swatch = completeRow.querySelector('span.rounded-full')
    expect(swatch).toHaveStyle({ background: '#94a3b8' })
    // The mapped pills keep their configured colours.
    const ontrackSwatch = screen
      .getByRole('button', { name: /On track/ })
      .querySelector('span.rounded-full')
    expect(ontrackSwatch).toHaveStyle({ background: '#1c6b4f' })
  })

  it('defers the fetch semantics via the enabled flag without crashing', async () => {
    counts = { ontrack: 1, overdue: 0, complete: 0 }
    renderWithProviders(
      <DistributionDonut
        title="Projects by health"
        icon="briefcase"
        table="project"
        area="/projects"
        pills={PILLS}
        colors={COLORS}
        enabled={false}
      />,
    )
    await waitFor(() => expect(screen.getByText('On track')).toBeInTheDocument())
  })
})
