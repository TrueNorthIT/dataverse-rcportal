import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortMenu, type SortOption } from './SortMenu'

const options: SortOption[] = [
  { key: 'recent', label: 'Most recent' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'Name' },
]

describe('SortMenu', () => {
  it('renders a "Sort" label and a labelled group of pills', () => {
    render(<SortMenu options={options} value="recent" onChange={() => {}} />)
    expect(screen.getByText('Sort')).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Sort by' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Most recent' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oldest' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Name' })).toBeInTheDocument()
  })

  it('marks the active option as pressed and gives it the gradient', () => {
    render(<SortMenu options={options} value="oldest" onChange={() => {}} />)
    const oldest = screen.getByRole('button', { name: 'Oldest' })
    const recent = screen.getByRole('button', { name: 'Most recent' })
    expect(oldest).toHaveAttribute('aria-pressed', 'true')
    expect(recent).toHaveAttribute('aria-pressed', 'false')
    expect(oldest).toHaveClass('rc-gradient')
    expect(recent).not.toHaveClass('rc-gradient')
  })

  it('calls onChange with the option key when a pill is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SortMenu options={options} value="recent" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('name')
  })

  it('lets the already-active pill be clicked (re-selection)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SortMenu options={options} value="recent" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Most recent' }))
    expect(onChange).toHaveBeenCalledWith('recent')
  })

  it('renders no pills when the options list is empty', () => {
    render(<SortMenu options={[]} value="" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Sort by' })).toBeEmptyDOMElement()
    // the Sort label is still present
    expect(screen.getByText('Sort')).toBeInTheDocument()
  })
})
