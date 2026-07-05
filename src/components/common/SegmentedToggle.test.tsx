import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedToggle } from './SegmentedToggle'

type Scope = 'this' | 'all'

const options = [
  { key: 'this' as const, label: 'This company' },
  { key: 'all' as const, label: 'All companies' },
]

describe('SegmentedToggle', () => {
  it('renders a tablist with the given aria-label and one tab per option', () => {
    render(
      <SegmentedToggle<Scope>
        value="this"
        onChange={() => {}}
        options={options}
        ariaLabel="Scope"
      />,
    )
    const tablist = screen.getByRole('tablist', { name: 'Scope' })
    expect(tablist).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('marks the active segment with aria-selected and the active styling', () => {
    render(
      <SegmentedToggle<Scope>
        value="all"
        onChange={() => {}}
        options={options}
        ariaLabel="Scope"
      />,
    )
    const active = screen.getByRole('tab', { name: 'All companies' })
    const inactive = screen.getByRole('tab', { name: 'This company' })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active).toHaveClass('bg-rc-blue', 'text-white')
    expect(inactive).toHaveAttribute('aria-selected', 'false')
    expect(inactive).toHaveClass('text-rc-teal')
  })

  it('calls onChange with the option key when a segment is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedToggle<Scope>
        value="this"
        onChange={onChange}
        options={options}
        ariaLabel="Scope"
      />,
    )
    await user.click(screen.getByRole('tab', { name: 'All companies' }))
    expect(onChange).toHaveBeenCalledWith('all')
  })

  it('still fires onChange when clicking the already-active segment', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedToggle<Scope>
        value="this"
        onChange={onChange}
        options={options}
        ariaLabel="Scope"
      />,
    )
    await user.click(screen.getByRole('tab', { name: 'This company' }))
    expect(onChange).toHaveBeenCalledWith('this')
  })

  it('appends a caller-supplied className to the tablist container', () => {
    render(
      <SegmentedToggle<Scope>
        value="this"
        onChange={() => {}}
        options={options}
        ariaLabel="Scope"
        className="ml-auto extra"
      />,
    )
    const tablist = screen.getByRole('tablist', { name: 'Scope' })
    expect(tablist).toHaveClass('inline-flex', 'ml-auto', 'extra')
  })
})
