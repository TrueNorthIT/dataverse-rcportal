import { render, screen } from '@testing-library/react'
import { DashboardChartsSkeleton } from './DashboardChartsSkeleton'

describe('DashboardChartsSkeleton', () => {
  it('mirrors the charts section: the heading and a card per chart', () => {
    render(<DashboardChartsSkeleton />)
    expect(screen.getByText('At a glance')).toBeInTheDocument()
    expect(screen.getByText('Projects by health')).toBeInTheDocument()
    expect(screen.getByText('Opportunities by state')).toBeInTheDocument()
    expect(screen.getByText('Sites by connectivity')).toBeInTheDocument()
    expect(screen.getByText('Deliveries by month')).toBeInTheDocument()
  })
})
