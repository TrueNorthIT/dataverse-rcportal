import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as a level-1 heading', () => {
    render(<PageHeader title="My Cases" />)
    const heading = screen.getByRole('heading', { level: 1, name: 'My Cases' })
    expect(heading).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(<PageHeader title="Sites" subtitle="All active locations" />)
    expect(screen.getByText('All active locations')).toBeInTheDocument()
  })

  it('omits the subtitle paragraph when not provided', () => {
    const { container } = render(<PageHeader title="Sites" />)
    expect(container.querySelector('p')).toBeNull()
  })

  it('renders the actions slot when provided', () => {
    render(<PageHeader title="Cases" actions={<button>Raise a ticket</button>} />)
    expect(screen.getByRole('button', { name: 'Raise a ticket' })).toBeInTheDocument()
  })

  it('omits the actions container when no actions are given', () => {
    render(<PageHeader title="Cases" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders both subtitle and actions together', () => {
    render(
      <PageHeader
        title="Cases"
        subtitle="Everything open"
        actions={<span>slot</span>}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Cases' })).toBeInTheDocument()
    expect(screen.getByText('Everything open')).toBeInTheDocument()
    expect(screen.getByText('slot')).toBeInTheDocument()
  })
})
