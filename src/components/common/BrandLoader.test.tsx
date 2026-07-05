import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandLoader } from './BrandLoader'

describe('BrandLoader', () => {
  it('exposes a polite status region for assistive tech', () => {
    render(<BrandLoader />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('renders the five equalizer bars', () => {
    const { container } = render(<BrandLoader />)
    expect(container.querySelectorAll('.rc-bar')).toHaveLength(5)
  })

  it('applies the staggered animation delay and brand colour to each bar', () => {
    const { container } = render(<BrandLoader />)
    const bars = container.querySelectorAll<HTMLElement>('.rc-bar')
    // first bar: no delay, rc-blue; third bar: 0.24s, rc-lime
    expect(bars[0].style.animationDelay).toBe('0s')
    expect(bars[0].style.backgroundColor).toBe('var(--color-rc-blue)')
    expect(bars[2].style.animationDelay).toBe('0.24s')
    expect(bars[2].style.backgroundColor).toBe('var(--color-rc-lime)')
  })

  it('shows the label text when provided', () => {
    render(<BrandLoader label="Loading cases…" />)
    expect(screen.getByText('Loading cases…')).toBeInTheDocument()
  })

  it('renders no label span when the label is omitted', () => {
    const { container } = render(<BrandLoader />)
    expect(container.querySelector('span.text-rc-teal')).toBeNull()
  })
})
