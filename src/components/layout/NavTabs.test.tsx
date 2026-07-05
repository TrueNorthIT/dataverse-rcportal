import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/render'
import { NavTabs } from './NavTabs'

// The Help menu's Feedback item opens a dialog through this context; spy on it.
const openFeedback = vi.fn()
vi.mock('../common/FeedbackDialog', () => ({
  useFeedback: () => ({ open: openFeedback }),
}))

describe('NavTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the core section tabs as links', () => {
    renderWithProviders(<NavTabs />)
    // Dashboard renders both a mobile glyph (aria-label) and desktop text.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Quotes' })).toHaveAttribute('href', '/quotes')
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects')
    expect(screen.getByRole('link', { name: 'Sites' })).toHaveAttribute('href', '/sites')
    expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/cases')
  })

  it('marks the tab for the current route as active', () => {
    renderWithProviders(<NavTabs />, { route: '/quotes' })
    const active = screen.getByRole('link', { name: 'Quotes' })
    // NavLink toggles the active branch of tabClass -> the rc-blue underline.
    expect(active).toHaveClass('border-rc-blue', 'text-rc-navy')
    const inactive = screen.getByRole('link', { name: 'Projects' })
    expect(inactive).toHaveClass('border-transparent')
  })

  it('treats the Dashboard tab as end-exact (not active on a sub-route)', () => {
    renderWithProviders(<NavTabs />, { route: '/quotes' })
    // `end` on Dashboard means it is NOT active when the URL is /quotes.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('border-transparent')
  })

  it('keeps the Help dropdown closed until clicked', () => {
    renderWithProviders(<NavTabs />)
    const help = screen.getByRole('button', { name: 'Help' })
    expect(help).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens the Help menu and reveals its items', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavTabs />)

    await user.click(screen.getByRole('button', { name: 'Help' }))

    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Knowledge base' })).toHaveAttribute(
      'href',
      '/knowledge',
    )
    expect(within(menu).getByRole('menuitem', { name: 'AI assistant' })).toHaveAttribute(
      'href',
      '/ai',
    )
    expect(within(menu).getByRole('menuitem', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Help' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('toggles the Help menu shut on a second click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavTabs />)
    const help = screen.getByRole('button', { name: 'Help' })

    await user.click(help)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(help)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the Help menu on outside pointerdown', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <NavTabs />
        <button type="button">outside</button>
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'Help' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // pointerdown outside the menu closes it (the source listens on pointerdown).
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button', { name: 'outside' }) })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the Help menu on Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavTabs />)
    await user.click(screen.getByRole('button', { name: 'Help' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the Help menu when a link item is chosen', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavTabs />)
    await user.click(screen.getByRole('button', { name: 'Help' }))

    await user.click(screen.getByRole('menuitem', { name: 'Knowledge base' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens the feedback dialog and closes the menu when Feedback is chosen', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavTabs />)
    await user.click(screen.getByRole('button', { name: 'Help' }))

    await user.click(screen.getByRole('menuitem', { name: 'Feedback' }))

    expect(openFeedback).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('highlights the Help button when on one of its routes', () => {
    renderWithProviders(<NavTabs />, { route: '/knowledge' })
    // active branch of the Help button className -> rc-blue underline.
    expect(screen.getByRole('button', { name: 'Help' })).toHaveClass('border-rc-blue')
  })

  it('highlights the Help button on a nested help sub-route', () => {
    renderWithProviders(<NavTabs />, { route: '/knowledge/some-article' })
    expect(screen.getByRole('button', { name: 'Help' })).toHaveClass('border-rc-blue')
  })

  it('does not highlight Help when off its routes', () => {
    renderWithProviders(<NavTabs />, { route: '/quotes' })
    expect(screen.getByRole('button', { name: 'Help' })).toHaveClass('border-transparent')
  })

  it('marks the current help link active inside the open menu', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NavTabs />, { route: '/ai' })
    await user.click(screen.getByRole('button', { name: 'Help' }))
    const ai = screen.getByRole('menuitem', { name: 'AI assistant' })
    expect(ai).toHaveClass('bg-rc-blue-light/50', 'font-medium')
  })
})
