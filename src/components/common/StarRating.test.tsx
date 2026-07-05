import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarRating } from './StarRating'

describe('StarRating (read-only)', () => {
  it('renders as an image with the value in its label when no onChange is given', () => {
    render(<StarRating value={3} />)
    const group = screen.getByRole('img', { name: '3 out of 5' })
    expect(group).toBeInTheDocument()
    // read-only mode renders no buttons
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders five stars, filling those up to the value', () => {
    const { container } = render(<StarRating value={2} />)
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(5)
    const filled = Array.from(svgs).filter((s) => s.getAttribute('fill') === 'currentColor')
    const empty = Array.from(svgs).filter((s) => s.getAttribute('fill') === 'none')
    expect(filled).toHaveLength(2)
    expect(empty).toHaveLength(3)
  })

  it('fills every star at a perfect score', () => {
    const { container } = render(<StarRating value={5} />)
    const filled = container.querySelectorAll('svg[fill="currentColor"]')
    expect(filled).toHaveLength(5)
  })

  it('fills no star at zero', () => {
    const { container } = render(<StarRating value={0} />)
    expect(container.querySelectorAll('svg[fill="currentColor"]')).toHaveLength(0)
  })

  it('honours a custom size', () => {
    const { container } = render(<StarRating value={1} size={40} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '40')
    expect(svg).toHaveAttribute('height', '40')
  })

  it('defaults to a 22px star', () => {
    const { container } = render(<StarRating value={1} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '22')
  })
})

describe('StarRating (interactive)', () => {
  it('renders a radiogroup with a labelled button per star', () => {
    render(<StarRating value={0} onChange={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: '0 out of 5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 star' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 stars' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5 stars' })).toBeInTheDocument()
  })

  it('reports the clicked star value through onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<StarRating value={0} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '4 stars' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('clears the rating when the current value is clicked again', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<StarRating value={3} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '3 stars' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('sets a new value when a different star than the current one is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<StarRating value={3} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '5 stars' }))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('fills the stars up to the current value in interactive mode too', () => {
    const { container } = render(<StarRating value={2} onChange={() => {}} />)
    expect(container.querySelectorAll('svg[fill="currentColor"]')).toHaveLength(2)
  })
})
