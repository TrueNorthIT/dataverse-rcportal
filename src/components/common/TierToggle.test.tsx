import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TierToggle } from './TierToggle'

describe('TierToggle', () => {
  it('renders "My" and "Company" segments under the Record scope tablist', () => {
    render(<TierToggle tier="me" onChange={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Record scope' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'My' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Company' })).toBeInTheDocument()
  })

  it('marks the "My" segment active when tier is "me"', () => {
    render(<TierToggle tier="me" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'My' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Company' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('marks the "Company" segment active when tier is "team"', () => {
    render(<TierToggle tier="team" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Company' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('calls onChange with "team" when Company is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TierToggle tier="me" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: 'Company' }))
    expect(onChange).toHaveBeenCalledWith('team')
  })

  it('calls onChange with "me" when My is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TierToggle tier="team" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: 'My' }))
    expect(onChange).toHaveBeenCalledWith('me')
  })
})
