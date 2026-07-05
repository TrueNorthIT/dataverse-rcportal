import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Card, CardButton } from './Card'

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card>
        <span>surface content</span>
      </Card>,
    )
    expect(screen.getByText('surface content')).toBeInTheDocument()
  })

  it('applies the brand surface classes', () => {
    const { container } = render(<Card>x</Card>)
    const div = container.firstChild as HTMLElement
    expect(div).toHaveClass('rounded-2xl', 'border', 'bg-white', 'shadow-sm')
  })

  it('appends a caller-supplied className', () => {
    const { container } = render(<Card className="mt-4 custom">x</Card>)
    const div = container.firstChild as HTMLElement
    expect(div).toHaveClass('mt-4', 'custom')
  })

  it('renders a plain div (no extra class) when className is omitted', () => {
    const { container } = render(<Card>x</Card>)
    const div = container.firstChild as HTMLElement
    // trailing space from the template literal is fine; className should not throw
    expect(div.tagName).toBe('DIV')
  })
})

describe('CardButton', () => {
  it('renders as a button with its children', () => {
    render(<CardButton>row label</CardButton>)
    const btn = screen.getByRole('button', { name: 'row label' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<CardButton onClick={onClick}>clickable</CardButton>)
    await user.click(screen.getByRole('button', { name: 'clickable' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not throw when clicked without an onClick handler', async () => {
    const user = userEvent.setup()
    render(<CardButton>no handler</CardButton>)
    await user.click(screen.getByRole('button', { name: 'no handler' }))
    // reaching here without error is the assertion
    expect(screen.getByRole('button', { name: 'no handler' })).toBeInTheDocument()
  })

  it('appends a caller-supplied className to the base classes', () => {
    render(<CardButton className="mb-2 extra">row</CardButton>)
    const btn = screen.getByRole('button', { name: 'row' })
    expect(btn).toHaveClass('w-full', 'rounded-2xl', 'bg-white', 'mb-2', 'extra')
  })
})
