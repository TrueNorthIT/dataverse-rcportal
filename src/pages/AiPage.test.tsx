import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { AiPage } from './AiPage'

// In the test env VITE_API_BASE_URL = https://api.test.local/api/v2/rcportal, so
// apiBaseUrl derives the MCP endpoint below.
const MCP_URL = 'https://api.test.local/api/v2/rcportal/mcp'

describe('AiPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the page header and pitch sections', () => {
    renderWithProviders(<AiPage />)
    expect(screen.getByRole('heading', { name: 'AI assistant', level: 1 })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Talk to your data/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Model Context Protocol/ })).toHaveAttribute(
      'href',
      'https://modelcontextprotocol.io',
    )
  })

  it('shows the MCP endpoint URL derived from the API base', () => {
    renderWithProviders(<AiPage />)
    expect(screen.getByText(MCP_URL)).toBeInTheDocument()
  })

  it('defaults to the ChatGPT tab and shows its numbered steps', () => {
    renderWithProviders(<AiPage />)
    expect(screen.getByText(/Add custom connector/)).toBeInTheDocument()
    // Numbered list is present (three steps).
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
  })

  it('switches to the Claude tab and shows its authorise step', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AiPage />)
    await user.click(screen.getByRole('button', { name: 'Claude' }))
    expect(screen.getByText(/authorise access/)).toBeInTheDocument()
  })

  it('switches to the Claude Code tab and shows the CLI command (not steps)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AiPage />)
    await user.click(screen.getByRole('button', { name: 'Claude Code' }))

    expect(
      screen.getByText(`claude mcp add redcentric --transport http ${MCP_URL}`),
    ).toBeInTheDocument()
    expect(screen.getByText(/opens a browser to sign you in/)).toBeInTheDocument()
    // The Claude Code guide has no numbered steps.
    expect(screen.queryByText(/Add custom connector/)).not.toBeInTheDocument()
  })

  it('renders the sample question/answer transcript', () => {
    renderWithProviders(<AiPage />)
    expect(
      screen.getByText(/How many open support tickets do we have/),
    ).toBeInTheDocument()
    expect(screen.getByText(/CAS.1042/)).toBeInTheDocument()
    expect(screen.getByText(/Update my mobile number/)).toBeInTheDocument()
  })

  it('renders the trust/reassurance section', () => {
    renderWithProviders(<AiPage />)
    expect(screen.getByText(/Your data stays yours\./)).toBeInTheDocument()
  })

  it('copies the endpoint URL and flips the label to "Copied", then resets', async () => {
    // Install a controllable clipboard so useCopy's writeText resolves on our
    // schedule, and use fireEvent (not userEvent) so fake timers stay simple.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    vi.useFakeTimers()
    renderWithProviders(<AiPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(MCP_URL)

    // Flush the writeText().then() microtask that sets "Copied".
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    // After 1500ms the label resets to "Copy".
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('copies the CLI command from the Claude Code code block', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AiPage />)
    await user.click(screen.getByRole('button', { name: 'Claude Code' }))

    // Now there are two "Copy" buttons: the endpoint row + the code block.
    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
    await user.click(copyButtons[copyButtons.length - 1])

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    await expect(navigator.clipboard.readText()).resolves.toBe(
      `claude mcp add redcentric --transport http ${MCP_URL}`,
    )
  })
})
