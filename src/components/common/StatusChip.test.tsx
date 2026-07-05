import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it('renders nothing for null, undefined and empty labels', () => {
    const { container: c1 } = render(<StatusChip label={null} />)
    expect(c1.firstChild).toBeNull()

    const { container: c2 } = render(<StatusChip label={undefined} />)
    expect(c2.firstChild).toBeNull()

    const { container: c3 } = render(<StatusChip label="" />)
    expect(c3.firstChild).toBeNull()
  })

  it('renders the label text in a pill', () => {
    render(<StatusChip label="Active" />)
    const chip = screen.getByText('Active')
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveClass('rounded-full')
  })

  it('uses the green tone for "won" family statuses', () => {
    render(<StatusChip label="Won" />)
    const chip = screen.getByText('Won')
    expect(chip).toHaveClass('bg-rc-green-light', 'text-rc-green-dark')
  })

  it('matches the green family case-insensitively (e.g. "In Progress")', () => {
    render(<StatusChip label="In Progress" />)
    expect(screen.getByText('In Progress')).toHaveClass('bg-rc-green-light')
  })

  it('uses the red tone for "lost/closed" family statuses', () => {
    render(<StatusChip label="Cancelled" />)
    const chip = screen.getByText('Cancelled')
    expect(chip).toHaveClass('bg-red-50', 'text-red-700')
  })

  it('matches "on hold" in the red family', () => {
    render(<StatusChip label="On Hold" />)
    expect(screen.getByText('On Hold')).toHaveClass('bg-red-50')
  })

  it('uses the blue tone for the "draft/pending/new" family', () => {
    render(<StatusChip label="Pending" />)
    const chip = screen.getByText('Pending')
    expect(chip).toHaveClass('bg-rc-blue-light', 'text-rc-navy')
  })

  it('falls back to the neutral teal tint for unknown labels', () => {
    render(<StatusChip label="Whatever" />)
    const chip = screen.getByText('Whatever')
    expect(chip).toHaveClass('bg-rc-blue-light', 'text-rc-teal')
  })
})
