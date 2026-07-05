import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RaiseCase } from './RaiseCase'

describe('RaiseCase', () => {
  it('disables submit until a summary is entered', async () => {
    const user = userEvent.setup()
    render(<RaiseCase create={vi.fn()} onCreated={vi.fn()} onCancel={vi.fn()} />)

    const submit = screen.getByRole('button', { name: 'Submit ticket' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Brief summary of the issue'), 'Printer down')
    expect(submit).toBeEnabled()
  })

  it('creates a ticket with the trimmed summary and details, then calls onCreated', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue({})
    const onCreated = vi.fn()
    render(<RaiseCase create={create} onCreated={onCreated} onCancel={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('Brief summary of the issue'), '  Printer down  ')
    await user.type(screen.getByPlaceholderText("What's happening, and any impact?"), 'No output')
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }))

    expect(create).toHaveBeenCalledWith({ title: 'Printer down', description: 'No output' })
    expect(onCreated).toHaveBeenCalled()
  })

  it('omits an empty description', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue({})
    render(<RaiseCase create={create} onCreated={vi.fn()} onCancel={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('Brief summary of the issue'), 'Just a title')
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }))

    expect(create).toHaveBeenCalledWith({ title: 'Just a title', description: undefined })
  })

  it('shows the error message when create rejects with an Error', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockRejectedValue(new Error('Server said no'))
    render(<RaiseCase create={create} onCreated={vi.fn()} onCancel={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('Brief summary of the issue'), 'X')
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }))

    expect(await screen.findByText('Server said no')).toBeInTheDocument()
  })

  it('falls back to a generic message for a non-Error rejection', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockRejectedValue('boom')
    render(<RaiseCase create={create} onCreated={vi.fn()} onCancel={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('Brief summary of the issue'), 'X')
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }))

    expect(await screen.findByText('Failed to raise ticket')).toBeInTheDocument()
  })

  it('cancels without creating', async () => {
    const user = userEvent.setup()
    const create = vi.fn()
    const onCancel = vi.fn()
    render(<RaiseCase create={create} onCreated={vi.fn()} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('ignores a submit with a blank summary (guard)', () => {
    const create = vi.fn()
    const { container } = render(
      <RaiseCase create={create} onCreated={vi.fn()} onCancel={vi.fn()} />,
    )
    // Submit the form directly, bypassing the disabled button, to hit the guard.
    fireEvent.submit(container.querySelector('form')!)
    expect(create).not.toHaveBeenCalled()
  })
})
