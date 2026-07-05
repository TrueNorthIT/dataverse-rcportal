import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScrollToTop } from './ScrollToTop'

/** Set window.scrollY and fire a scroll event the way the component listens for it. */
function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
    window.dispatchEvent(new Event('scroll'))
  })
}

describe('ScrollToTop', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('is hidden until the page is scrolled past a screenful', () => {
    render(<ScrollToTop />)
    // starts hidden (scrollY 0 on mount)
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
  })

  it('appears once already scrolled past 600px on mount', () => {
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true, writable: true })
    render(<ScrollToTop />)
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument()
  })

  it('fades in after scrolling down and hides again after scrolling back up', () => {
    render(<ScrollToTop />)
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()

    scrollTo(700)
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument()

    scrollTo(100)
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
  })

  it('stays hidden exactly at the 600px threshold and shows just past it', () => {
    render(<ScrollToTop />)
    scrollTo(600)
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
    scrollTo(601)
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument()
  })

  it('smooth-scrolls to the top when clicked', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(window, 'scrollTo')
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true, writable: true })
    render(<ScrollToTop />)

    await user.click(screen.getByRole('button', { name: 'Back to top' }))
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('removes its scroll listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<ScrollToTop />)
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
