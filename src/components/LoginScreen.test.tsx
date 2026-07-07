import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { entraConfig } from '../config/entra'
import { LoginScreen } from './LoginScreen'

/**
 * `LoginScreen` is the unauthenticated landing page. Its only behaviour is the
 * "Sign in" button, which asks MSAL to start the Entra redirect flow with the
 * API scope — so we mock `useMsal` and assert the call.
 */

const loginRedirect = vi.fn<(request: { scopes: string[]; prompt?: string }) => Promise<void>>()

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: { loginRedirect } }),
}))

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loginRedirect.mockResolvedValue(undefined)
  })

  it('renders the branding, heading and marketing copy', () => {
    render(<LoginScreen />)

    expect(screen.getByRole('img', { name: 'Redcentric' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Customer Portal' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Sign in to view and manage your contact details/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Powered by the Dataverse Contact API'),
    ).toBeInTheDocument()
  })

  it('starts the Entra redirect with the API scope when Sign in is clicked', async () => {
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(loginRedirect).toHaveBeenCalledTimes(1)
    expect(loginRedirect).toHaveBeenCalledWith({ scopes: [entraConfig.apiScope] })
  })

  it('starts the Entra sign-up flow (prompt=create) when Create an account is clicked', async () => {
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.click(screen.getByRole('button', { name: 'Create an account' }))

    expect(loginRedirect).toHaveBeenCalledTimes(1)
    expect(loginRedirect).toHaveBeenCalledWith({ scopes: [entraConfig.apiScope], prompt: 'create' })
  })

  it('does not throw when loginRedirect rejects (fire-and-forget)', async () => {
    const user = userEvent.setup()
    loginRedirect.mockRejectedValueOnce(new Error('popup blocked'))
    render(<LoginScreen />)

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(loginRedirect).toHaveBeenCalledTimes(1)
  })
})
