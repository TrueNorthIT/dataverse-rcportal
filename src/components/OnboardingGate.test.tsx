import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../test/render'
import { makeClient, type MockClient } from '../test/dataverse'

// OnboardingGate builds its own base client via the SDK's createClient. Hand it
// a mock we control, stub the token getter, and reduce JoinScreen to a marker
// (it's unit-tested on its own).
const state = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@truenorth-it/dataverse-client', () => ({ createClient: () => state.client }))
vi.mock('../lib/getToken', () => ({ useGetToken: () => vi.fn() }))
vi.mock('./JoinScreen', () => ({ JoinScreen: () => <div>Join screen</div> }))

import { OnboardingGate } from './OnboardingGate'

let client: MockClient
const whoami = (dataverseContact: unknown) => ({
  dataverseContact,
  companies: [],
  hasMultipleCompanies: false,
  identity: { sub: 's', permissions: [] as string[] },
})

beforeEach(() => {
  client = makeClient()
  state.client = client
})

describe('OnboardingGate', () => {
  it('shows the branded loader while whoami resolves', () => {
    client.me.whoami.mockReturnValue(new Promise(() => {}))
    renderWithProviders(
      <OnboardingGate>
        <div>APP</div>
      </OnboardingGate>,
    )
    expect(screen.getByText('Getting things ready…')).toBeInTheDocument()
  })

  it('renders the app when the caller already has a contact', async () => {
    client.me.whoami.mockResolvedValue(whoami({ contactid: 'c1', emailaddress1: 'a@b.com' }))
    renderWithProviders(
      <OnboardingGate>
        <div>APP</div>
      </OnboardingGate>,
    )
    expect(await screen.findByText('APP')).toBeInTheDocument()
    expect(screen.queryByText('Join screen')).not.toBeInTheDocument()
  })

  it('shows the join screen when the caller has no contact', async () => {
    client.me.whoami.mockResolvedValue(whoami(null))
    renderWithProviders(
      <OnboardingGate>
        <div>APP</div>
      </OnboardingGate>,
    )
    expect(await screen.findByText('Join screen')).toBeInTheDocument()
    expect(screen.queryByText('APP')).not.toBeInTheDocument()
  })

  it('falls through to the app if whoami fails (never traps the user)', async () => {
    client.me.whoami.mockRejectedValue(new Error('network'))
    renderWithProviders(
      <OnboardingGate>
        <div>APP</div>
      </OnboardingGate>,
    )
    expect(await screen.findByText('APP')).toBeInTheDocument()
  })
})
