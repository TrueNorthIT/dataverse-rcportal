import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, paginated, type MockClient } from '../test/dataverse'
import type { Account } from '../types/account'
import type { Contact } from '../types/contact'
import { CompanyPage } from './CompanyPage'

const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({
    selectedContactId: undefined,
    allCompanies: false,
    companies: [],
    hasMultiple: false,
    loading: false,
  }),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigate }
})

function makeAccount(over: Partial<Account> = {}): Account {
  return {
    accountid: 'a1',
    name: 'Acme Ltd',
    telephone1: '020 1234 5678',
    websiteurl: 'https://acme.example',
    emailaddress1: 'hello@acme.example',
    address1_line1: '1 High Street',
    address1_city: 'London',
    address1_postalcode: 'EC1A 1AA',
    address1_country: 'UK',
    ...(over as Account),
  } as Account
}

function makeColleague(over: Partial<Contact> = {}): Contact {
  return {
    contactid: 'p1',
    fullname: 'Ada Lovelace',
    jobtitle: 'Analytical Engineer',
    emailaddress1: 'ada@acme.example',
    telephone1: '020 0000 0000',
    mobilephone: '07000 000000',
    donotbulkemail: false,
    ...(over as Contact),
  } as Contact
}

/**
 * Both useMyCompany (account) and the colleagues list (contact) resolve through
 * client.team.list — route each by the table name so a test can set them apart.
 */
function routeTeamList(account: Account | null, colleagues: Contact[], colleaguesNext: string | null = null) {
  client.team.list.mockImplementation((table: string) => {
    if (table === 'account') return Promise.resolve(paginated(account ? [account] : []))
    return Promise.resolve(paginated(colleagues, colleaguesNext))
  })
}

describe('CompanyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the account details once loaded', async () => {
    routeTeamList(makeAccount(), [])
    renderWithProviders(<CompanyPage />)

    expect(await screen.findAllByText('Acme Ltd')).not.toHaveLength(0)
    expect(screen.getByText('020 1234 5678')).toBeInTheDocument()
    expect(screen.getByText('hello@acme.example')).toBeInTheDocument()
    // Address parts are joined into one line.
    expect(screen.getByText('1 High Street, London, EC1A 1AA, UK')).toBeInTheDocument()
    // Website renders as an external link.
    const link = screen.getByRole('link', { name: 'https://acme.example' })
    expect(link).toHaveAttribute('href', 'https://acme.example')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('shows a dash for missing account fields', async () => {
    routeTeamList(makeAccount({ telephone1: undefined, websiteurl: undefined, emailaddress1: undefined }), [])
    renderWithProviders(<CompanyPage />)
    await screen.findByText('London', { exact: false })
    // At least one em-dash placeholder for the missing values.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('surfaces an account error', async () => {
    client.team.list.mockImplementation((table: string) => {
      if (table === 'account') return Promise.reject(new Error('No account access'))
      return Promise.resolve(paginated<Contact>([]))
    })
    renderWithProviders(<CompanyPage />)
    expect(await screen.findByText('No account access')).toBeInTheDocument()
  })

  it('renders the colleagues directory', async () => {
    routeTeamList(makeAccount(), [
      makeColleague(),
      makeColleague({
        contactid: 'p2',
        fullname: 'Grace Hopper',
        jobtitle: undefined,
        emailaddress1: 'grace@acme.example',
        telephone1: undefined,
        mobilephone: undefined,
      }),
    ])
    renderWithProviders(<CompanyPage />)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Analytical Engineer')).toBeInTheDocument()
    expect(screen.getByText('ada@acme.example')).toBeInTheDocument()
    expect(screen.getByText('020 0000 0000 · 07000 000000')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('grace@acme.example')).toBeInTheDocument()
  })

  it('shows the no-name placeholder for a colleague without a full name', async () => {
    routeTeamList(makeAccount(), [makeColleague({ fullname: '' })])
    renderWithProviders(<CompanyPage />)
    // fullname falls back to an em-dash inside the colleague card.
    expect(await screen.findByText('—')).toBeInTheDocument()
  })

  it('shows the "No marketing" opt-out pill for a colleague who opted out', async () => {
    routeTeamList(makeAccount(), [makeColleague({ donotbulkemail: true })])
    renderWithProviders(<CompanyPage />)
    expect(await screen.findByText('No marketing')).toBeInTheDocument()
  })

  it('shows the empty colleagues message', async () => {
    routeTeamList(makeAccount(), [])
    renderWithProviders(<CompanyPage />)
    expect(await screen.findByText('No colleagues found for your company.')).toBeInTheDocument()
  })

  it('surfaces a colleagues list error', async () => {
    client.team.list.mockImplementation((table: string) => {
      if (table === 'account') return Promise.resolve(paginated([makeAccount()]))
      return Promise.reject(new Error('Colleagues unavailable'))
    })
    renderWithProviders(<CompanyPage />)
    expect(await screen.findByText('Colleagues unavailable')).toBeInTheDocument()
  })

  it('navigates to a colleague with the sibling ids and team tier in state', async () => {
    routeTeamList(makeAccount(), [
      makeColleague({ contactid: 'p1' }),
      makeColleague({ contactid: 'p2', fullname: 'Grace Hopper' }),
    ])
    renderWithProviders(<CompanyPage />)
    await screen.findByText('Ada Lovelace')

    await userEvent.setup().click(screen.getByText('Ada Lovelace'))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/company/p1',
        expect.objectContaining({
          state: expect.objectContaining({ ids: ['p1', 'p2'], tier: 'team' }),
        }),
      ),
    )
  })
})
