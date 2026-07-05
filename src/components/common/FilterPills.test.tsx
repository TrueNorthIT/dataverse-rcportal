import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterPills, type PillOption } from './FilterPills'

const options: PillOption[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
]

describe('FilterPills', () => {
  it('renders a labelled group with a button per option', () => {
    render(<FilterPills options={options} value="all" onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Filter' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Closed' })).toBeInTheDocument()
  })

  it('marks only the selected pill as pressed and wears the gradient', () => {
    render(<FilterPills options={options} value="open" onChange={() => {}} />)
    const open = screen.getByRole('button', { name: 'Open' })
    const all = screen.getByRole('button', { name: 'All' })
    expect(open).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveAttribute('aria-pressed', 'false')
    expect(open).toHaveClass('rc-gradient')
    expect(all).not.toHaveClass('rc-gradient')
  })

  it('calls onChange with the pill key when clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FilterPills options={options} value="all" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Closed' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('closed')
  })

  it('renders disabled keys as non-interactive with a helpful title', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <FilterPills
        options={options}
        value="all"
        onChange={onChange}
        disabledKeys={new Set(['closed'])}
      />,
    )
    const closed = screen.getByRole('button', { name: 'Closed' })
    expect(closed).toBeDisabled()
    expect(closed).toHaveAttribute('title', 'None to show')
    expect(closed).toHaveClass('cursor-not-allowed')
    await user.click(closed)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('never disables the active pill even if its key is in disabledKeys', () => {
    render(
      <FilterPills
        options={options}
        value="closed"
        onChange={() => {}}
        disabledKeys={new Set(['closed'])}
      />,
    )
    const closed = screen.getByRole('button', { name: 'Closed' })
    expect(closed).not.toBeDisabled()
    expect(closed).toHaveClass('rc-gradient')
    expect(closed).not.toHaveAttribute('title')
  })

  it('applies an extra className to the wrapper', () => {
    render(
      <FilterPills options={options} value="all" onChange={() => {}} className="mt-4" />,
    )
    expect(screen.getByRole('group', { name: 'Filter' })).toHaveClass('mt-4')
  })

  it('renders an empty group when no options are given', () => {
    render(<FilterPills options={[]} value="" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Filter' })).toBeEmptyDOMElement()
  })
})
