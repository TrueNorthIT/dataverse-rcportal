import { describe, expect, it, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, type MockClient } from '../test/dataverse'
import { JoinScreen } from './JoinScreen'

let client: MockClient

const registerOk = {
  created: true,
  companies: [],
  dataverseContact: null,
  identity: { sub: 's', permissions: [] as string[] },
}

beforeEach(() => {
  client = makeClient()
  client.me.register.mockResolvedValue(registerOk)
})

describe('JoinScreen', () => {
  it('greets the joiner and lists the domain-matched companies', async () => {
    client.me.claimableCompanies.mockResolvedValue({
      companies: [
        { accountId: 'a1', name: 'Acme Ltd', city: 'Leeds' },
        { accountId: 'a2', name: 'Acme Labs' },
      ],
    })
    renderWithProviders(<JoinScreen client={client} />)

    expect(screen.getByText(/Welcome to the Redcentric Customer Portal/)).toBeInTheDocument()
    expect(await screen.findByText('Acme Ltd')).toBeInTheDocument()
    expect(screen.getByText('Acme Labs')).toBeInTheDocument()
  })

  it('joins the selected companies, sending name + accountIds to register', async () => {
    const user = userEvent.setup()
    client.me.claimableCompanies.mockResolvedValue({
      companies: [
        { accountId: 'a1', name: 'Acme Ltd' },
        { accountId: 'a2', name: 'Acme Labs' },
      ],
    })
    renderWithProviders(<JoinScreen client={client} />)

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Doe')
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

  it('lets the user create an account even when nothing matches their domain', async () => {
    const user = userEvent.setup()
    client.me.claimableCompanies.mockResolvedValue({ companies: [] })
    renderWithProviders(<JoinScreen client={client} />)

    expect(await screen.findByText(/couldn’t match any companies/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Join' }))

    await waitFor(() =>
      expect(client.me.register).toHaveBeenCalledWith({
        firstname: undefined,
        lastname: undefined,
        accountIds: [],
      }),
    )
  })

  it('surfaces a domain-rejection error from the API', async () => {
    const user = userEvent.setup()
    client.me.claimableCompanies.mockResolvedValue({ companies: [{ accountId: 'a1', name: 'Acme Ltd' }] })
    client.me.register.mockRejectedValue(new Error('You can only join companies on your email domain (acme.co.uk).'))
    renderWithProviders(<JoinScreen client={client} />)

    await screen.findByText('Acme Ltd')
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(await screen.findByText(/only join companies on your email domain/i)).toBeInTheDocument()
  })
})
