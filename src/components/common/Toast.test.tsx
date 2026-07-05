import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from './Toast'

/** A tiny consumer that fires toasts on demand so we can drive the provider. */
function Harness() {
  const { show } = useToast()
  return (
    <div>
      <button onClick={() => show('Saved')}>save</button>
      <button onClick={() => show('Sent')}>send</button>
    </div>
  )
}

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders children and no toasts initially', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )

    expect(screen.getByText('save')).toBeInTheDocument()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('shows a toast with the given message when show() is called', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )

    await user.click(screen.getByText('save'))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('stacks multiple toasts, each with its own message', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )

    await user.click(screen.getByText('save'))
    await user.click(screen.getByText('send'))

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
  })

  it('dismisses a toast when it is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )

    await user.click(screen.getByText('save'))
    const toast = await screen.findByRole('button', { name: /Saved/ })

    await user.click(toast)
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('auto-dismisses a toast after the timeout elapses', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )

    // fireEvent avoids userEvent's async waits, which don't mix with the
    // provider's real setTimeout under fake timers.
    fireEvent.click(screen.getByText('save'))
    expect(screen.getByText('Saved')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3200)
    })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('the default (out-of-provider) context show() is a safe no-op', () => {
    // Consuming useToast without a provider yields the default no-op; calling it
    // must not throw.
    function Bare() {
      const { show } = useToast()
      return <button onClick={() => show('x')}>go</button>
    }
    render(<Bare />)
    expect(() => screen.getByText('go').click()).not.toThrow()
  })
})
