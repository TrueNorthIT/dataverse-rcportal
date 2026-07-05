import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartCard, ChartEmpty, ChartSkeleton } from './ChartCard'

describe('ChartCard', () => {
  it('renders the title, an icon chip and the chart body children', () => {
    render(
      <ChartCard title="Deliveries by month" icon="activity">
        <div data-testid="body">chart goes here</div>
      </ChartCard>,
    )

    expect(screen.getByRole('heading', { name: 'Deliveries by month' })).toBeInTheDocument()
    expect(screen.getByTestId('body')).toHaveTextContent('chart goes here')
    // The icon chip renders an inline (aria-hidden) svg.
    expect(document.querySelector('svg')).toBeInTheDocument()
  })
})

describe('ChartSkeleton', () => {
  it('renders a labelled loading block with the default size', () => {
    render(<ChartSkeleton />)
    const block = screen.getByLabelText('Loading')
    expect(block).toBeInTheDocument()
    expect(block).toHaveClass('h-32', 'w-full')
  })

  it('honours a caller-supplied size class', () => {
    render(<ChartSkeleton className="h-48 w-full" />)
    const block = screen.getByLabelText('Loading')
    expect(block).toHaveClass('h-48', 'w-full')
    expect(block).not.toHaveClass('h-32')
  })
})

describe('ChartEmpty', () => {
  it('shows the default empty message', () => {
    render(<ChartEmpty />)
    expect(screen.getByText('Nothing to chart yet.')).toBeInTheDocument()
  })

  it('shows a caller-supplied empty message', () => {
    render(<ChartEmpty message="No delivery history yet." />)
    expect(screen.getByText('No delivery history yet.')).toBeInTheDocument()
    expect(screen.queryByText('Nothing to chart yet.')).not.toBeInTheDocument()
  })
})
