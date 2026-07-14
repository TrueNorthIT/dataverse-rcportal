import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, type MockClient } from '../test/dataverse'
import { JoinScreen } from './JoinScreen'

// The join form pre-fills the name from the signed-in Entra account and offers a
// "sign in again" action, so mock a signed-in user + loginRedirect.
const { loginRedirect } = vi.hoisted(() => ({ loginRedirect: vi.fn() }))
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: {
      getActiveAccount: () => ({
        homeAccountId: 'h1',
        name: 'Jane Doe',
        idTokenClaims: { given_name: 'Jane', family_name: 'Doe', email: 'jane@acme.co.uk' },
      }),
      loginRedirect,
    },
    accounts: [],
  }),
}))

let client: MockClient

const registerOk = {
  created: true,
  companies: [],
  dataverseContact: null,
  identity: { sub: 's', permissions: [] as string[] },
}

beforeEach(() => {
  vi.clearAllMocks()
  client = makeClient()
  client.me.register.mockResolvedValue(registerOk)
})

describe('JoinScreen', () => {
  it('greets the joiner and lists the domain-matched companies', async () => {
    client.me.claimableCompanies.mockResolvedValue({
      requireDomainMatch: true,
      companies: [
        { accountId: 'a1', name: 'Acme Ltd', city: 'Leeds' },
        { accountId: 'a2', name: 'Acme Labs' },
      ],
    })
    renderWithProviders(<JoinScreen client={client} />)

    expect(screen.getByText(/Welcome to the Redcentric Customer Hub/)).toBeInTheDocument()
    expect(await screen.findByText('Acme Ltd')).toBeInTheDocument()
    expect(screen.getByText('Acme Labs')).toBeInTheDocument()
  })

  it("pre-fills the name and shows the signed-in email", () => {
    renderWithProviders(<JoinScreen client={client} />)

    expect(screen.getByLabelText('First name')).toHaveValue('Jane')
    expect(screen.getByLabelText('Last name')).toHaveValue('Doe')
    expect(screen.getByText(/jane@acme\.co\.uk/)).toBeInTheDocument()
  })

  it('joins the selected companies, sending the inferred name + accountIds', async () => {
    const user = userEvent.setup()
    client.me.claimableCompanies.mockResolvedValue({
      requireDomainMatch: true,
      companies: [
        { accountId: 'a1', name: 'Acme Ltd' },
        { accountId: 'a2', name: 'Acme Labs' },
      ],
    })
    renderWithProviders(<JoinScreen client={client} />)

    await screen.findByText('Acme Ltd')
    await user.click(screen.getAllByRole('checkbox')[0]) // Acme Ltd
    await user.click(screen.getByRole('button', { name: 'Join' }))

    await waitFor(() =>
      expect(client.me.register).toHaveBeenCalledWith({
        firstname: 'Jane',
        lastname: 'Doe',
        accountIds: ['a1'],
      }),
    )
  })

  it('lets the user create an account when nothing matches and a match is not required', async () => {
    const user = userEvent.setup()
    client.me.claimableCompanies.mockResolvedValue({ companies: [], requireDomainMatch: false })
    renderWithProviders(<JoinScreen client={client} />)

    expect(await screen.findByText(/couldn’t match any companies/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Join' }))

    await waitFor(() =>
      expect(client.me.register).toHaveBeenCalledWith({
        firstname: 'Jane',
        lastname: 'Doe',
        accountIds: [],
      }),
    )
  })

  it('blocks sign-up when nothing matches and the scope requires a match', async () => {
    client.me.claimableCompanies.mockResolvedValue({ companies: [], requireDomainMatch: true })
    renderWithProviders(<JoinScreen client={client} />)

    expect(await screen.findByText(/not a member of any trusted domain/i)).toBeInTheDocument()
    // No way to proceed — the Join button is gone.
    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument()
    expect(client.me.register).not.toHaveBeenCalled()
  })

  it('offers to sign in with a different account', async () => {
    const user = userEvent.setup()
    renderWithProviders(<JoinScreen client={client} />)

    await user.click(screen.getByRole('button', { name: /sign in with a different account/i }))
    expect(loginRedirect).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'select_account' }))
  })

  it('surfaces a domain-rejection error from the API', async () => {
    const user = userEvent.setup()
    client.me.claimableCompanies.mockResolvedValue({ requireDomainMatch: true, companies: [{ accountId: 'a1', name: 'Acme Ltd' }] })
    client.me.register.mockRejectedValue(new Error('You can only join companies on your email domain (acme.co.uk).'))
    renderWithProviders(<JoinScreen client={client} />)

    await screen.findByText('Acme Ltd')
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(await screen.findByText(/only join companies on your email domain/i)).toBeInTheDocument()
  })
})
