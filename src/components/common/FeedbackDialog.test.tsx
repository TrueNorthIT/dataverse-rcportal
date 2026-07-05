import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { makeClient, single, type MockClient } from '../../test/dataverse'
import { testQueryClient } from '../../test/render'
import { FeedbackProvider, useFeedback } from './FeedbackDialog'

// The dialog resolves its client + toast through these modules; mocking them
// lets a test assert the create call and the success toast in isolation.
const client: MockClient = makeClient()
vi.mock('../../lib/client', () => ({ useDataverseClient: () => client }))

const showToast = vi.fn()
vi.mock('./Toast', () => ({ useToast: () => ({ show: showToast }) }))

/** Trigger to open the modal from anywhere in the tree, like the Help menu. */
function OpenButton() {
  const { open } = useFeedback()
  return <button onClick={open}>open feedback</button>
}

function renderProvider() {
  const qc = testQueryClient()
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(
    <FeedbackProvider>
      <OpenButton />
    </FeedbackProvider>,
    { wrapper: Wrapper },
  )
}

describe('FeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.me.create.mockResolvedValue(single({}))
  })

  it('is closed until open() is called', () => {
    renderProvider()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the modal when the trigger fires', async () => {
    const user = userEvent.setup()
    renderProvider()

    await user.click(screen.getByText('open feedback'))
    expect(screen.getByRole('dialog', { name: 'Send feedback' })).toBeInTheDocument()
    expect(screen.getByText('Feedback')).toBeInTheDocument()
  })

  it('disables Send until a non-empty message is typed', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    const send = screen.getByRole('button', { name: 'Send feedback' })
    expect(send).toBeDisabled()

    await user.type(screen.getByPlaceholderText(/What's working well/), 'Great portal')
    expect(send).toBeEnabled()
  })

  it('submits the message + rating and shows a success toast, then closes', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    await user.click(screen.getByRole('button', { name: '4 stars' }))
    await user.type(screen.getByPlaceholderText(/What's working well/), 'Loving it')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    await waitFor(() =>
      expect(client.me.create).toHaveBeenCalledWith('portalfeedback', {
        new_name: 'Loving it',
        new_message: 'Loving it',
        new_rating: 4,
      }),
    )
    expect(showToast).toHaveBeenCalledWith('Thanks — your feedback was sent')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('falls back to a default name and omits rating when none is given', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    // Whitespace around the message is trimmed; a blank name defaults.
    await user.type(screen.getByPlaceholderText(/What's working well/), '  hi  ')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    await waitFor(() =>
      expect(client.me.create).toHaveBeenCalledWith('portalfeedback', {
        new_name: 'hi',
        new_message: 'hi',
        new_rating: undefined,
      }),
    )
  })

  it('truncates a long name to 60 chars while keeping the full message', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    const long = 'x'.repeat(80)
    await user.type(screen.getByPlaceholderText(/What's working well/), long)
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    await waitFor(() => expect(client.me.create).toHaveBeenCalled())
    const [, payload] = client.me.create.mock.calls[0] as [string, Record<string, unknown>]
    expect(payload.new_name).toHaveLength(60)
    expect(payload.new_message).toHaveLength(80)
  })

  it('does not submit when the form is submitted with only whitespace', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    // Space keeps the textarea non-empty for the required attr but trims to '';
    // the submit guard blocks the mutation.
    const textarea = screen.getByPlaceholderText(/What's working well/)
    await user.type(textarea, '   ')
    // Send is disabled for a whitespace-only message.
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeDisabled()
    expect(client.me.create).not.toHaveBeenCalled()
  })

  it('form submit is a no-op when the message trims to empty (guard branch)', async () => {
    const user = userEvent.setup()
    const { container } = renderProvider()
    await user.click(screen.getByText('open feedback'))

    // Fire the form's submit directly with an empty message: the `if
    // (message.trim())` guard blocks the mutation and the dialog stays open.
    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    expect(client.me.create).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows an error message and stays open when the send fails', async () => {
    client.me.create.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    await user.type(screen.getByPlaceholderText(/What's working well/), 'oops')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(await screen.findByText(/Couldn’t send/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('closes when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the header Close (X) button is clicked', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    // The backdrop is the aria-hidden overlay behind the dialog panel.
    const backdrop = document.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement
    await user.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows "Sending…" on the submit button while the mutation is pending', async () => {
    let resolve: (v: unknown) => void = () => {}
    client.me.create.mockReturnValue(new Promise((r) => (resolve = r)))
    const user = userEvent.setup()
    renderProvider()
    await user.click(screen.getByText('open feedback'))

    await user.type(screen.getByPlaceholderText(/What's working well/), 'pending')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled()
    resolve(single({}))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('the default (out-of-provider) open() is a safe no-op', () => {
    function Bare() {
      const { open } = useFeedback()
      return <button onClick={open}>go</button>
    }
    render(<Bare />)
    expect(() => screen.getByText('go').click()).not.toThrow()
  })
})
