import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CookieNotice } from './CookieNotice'
import { getStoredClarityConsent } from '../../lib/clarity'

// Uses the real clarity lib: choices persist to localStorage and the consent
// signal is a no-op because window.clarity is never installed in tests.
beforeEach(() => localStorage.clear())

describe('CookieNotice', () => {
  it('renders nothing when Clarity is not configured', () => {
    const { container } = render(<CookieNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('asks for consent when configured and no choice is stored', () => {
    render(<CookieNotice projectId="abc123" />)
    expect(screen.getByRole('region', { name: /cookie notice/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /no thanks/i })).toBeInTheDocument()
  })

  it('accept stores a granted choice and dismisses the banner', async () => {
    render(<CookieNotice projectId="abc123" />)
    await userEvent.click(screen.getByRole('button', { name: /accept/i }))
    expect(getStoredClarityConsent()).toBe('granted')
    expect(screen.queryByRole('region', { name: /cookie notice/i })).not.toBeInTheDocument()
  })

  it('decline stores a denied choice and dismisses the banner', async () => {
    render(<CookieNotice projectId="abc123" />)
    await userEvent.click(screen.getByRole('button', { name: /no thanks/i }))
    expect(getStoredClarityConsent()).toBe('denied')
    expect(screen.queryByRole('region', { name: /cookie notice/i })).not.toBeInTheDocument()
  })

  it('stays hidden once a choice has been made', () => {
    localStorage.setItem('rcportal.clarityConsent', 'granted')
    const { container } = render(<CookieNotice projectId="abc123" />)
    expect(container).toBeEmptyDOMElement()
  })
})
