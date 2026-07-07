import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { paginated, single } from '../test/dataverse'
import type { Contact } from '../types/contact'
import type { Case } from '../types/case'

// vi.hoisted lifts client creation above the hoisted mock factories + SUT import.
const { client } = await vi.hoisted(async () => {
  const { makeClient } = await import('../test/dataverse')
  return { client: makeClient() }
})
vi.mock('../lib/client', () => ({ useDataverseClient: () => client, publicClient: client }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({
    selectedCompanyId: undefined,
    allCompanies: false,
    companies: [],
    hasMultiple: false,
    loading: false,
  }),
}))

const { ColleagueDetailPage } = await import('./ColleagueDetailPage')

const FIXED_NOW = '2026-07-05T12:00:00Z'

function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    contactid: 'p1',
    fullname: 'Ada Lovelace',
    jobtitle: 'Analyst',
    department: 'Engineering',
    emailaddress1: 'ada@acme.test',
    telephone1: '0113 000 0000',
    mobilephone: '07700 900000',
    address1_line1: '1 High St',
    address1_city: 'Leeds',
    address1_postalcode: 'LS1 1AA',
    address1_country: 'UK',
    donotbulkemail: false,
    ...over,
  }
}

function makeCase(over: Partial<Case> = {}): Case {
  return {
    incidentid: 'k1',
    title: 'Slow VPN',
    ticketnumber: 'CAS-2002',
    statuscode_label: 'Active',
    createdon: '2026-07-01T09:00:00Z',
    ...over,
  }
}

function renderPage(route = '/company/p1', state?: unknown) {
  return renderWithProviders(<ColleagueDetailPage />, { path: '/company/:id', route, state })
}

describe('ColleagueDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fake only the clock so formatDate is deterministic — keep real timers so
    // findBy*/waitFor polling still fires.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FIXED_NOW))
    client.team.get.mockResolvedValue(single(makeContact()))
    client.team.list.mockResolvedValue(paginated<Case>([]))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton while the colleague loads', () => {
    client.team.get.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelector('.rc-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ada Lovelace' })).not.toBeInTheDocument()
  })

  it('renders the colleague profile and contact meta', async () => {
    client.team.get.mockResolvedValue(single(makeContact()))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText('Analyst')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('ada@acme.test')).toBeInTheDocument()
    expect(screen.getByText('07700 900000')).toBeInTheDocument()
    // Address is joined from its parts.
    expect(screen.getByText('1 High St, Leeds, LS1 1AA, UK')).toBeInTheDocument()
    expect(client.team.get).toHaveBeenCalledWith('contact', 'p1', expect.objectContaining({ select: expect.any(Array) }))
  })

  it('falls back to "Colleague" when the record has no full name', async () => {
    client.team.get.mockResolvedValue(single(makeContact({ fullname: '' })))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Colleague' })).toBeInTheDocument()
  })

  it('shows the "No marketing" badge when the colleague opted out', async () => {
    client.team.get.mockResolvedValue(single(makeContact({ donotbulkemail: true })))
    renderPage()
    expect(await screen.findByText('No marketing')).toBeInTheDocument()
  })

  it('does not show the "No marketing" badge when opted in', async () => {
    client.team.get.mockResolvedValue(single(makeContact({ donotbulkemail: false })))
    renderPage()
    await screen.findByRole('heading', { name: 'Ada Lovelace' })
    expect(screen.queryByText('No marketing')).not.toBeInTheDocument()
  })

  it('surfaces an error message when the colleague fails to load', async () => {
    client.team.get.mockRejectedValue(new Error('boom'))
    renderPage()
    // A non-404 error surfaces its message verbatim (the friendly not-available
    // state is reserved for 404s — see DetailChrome.test).
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('renders the recent cases list with count and ticket number', async () => {
    client.team.get.mockResolvedValue(single(makeContact()))
    client.team.list.mockResolvedValue(
      paginated<Case>([makeCase(), makeCase({ incidentid: 'k2', title: 'Email bounce', ticketnumber: 'CAS-2003' })]),
    )
    renderPage()

    expect(await screen.findByText('Slow VPN')).toBeInTheDocument()
    expect(screen.getByText('Email bounce')).toBeInTheDocument()
    // Count is rendered in the section title.
    expect(screen.getByText('(2)')).toBeInTheDocument()
    expect(screen.getByText(/CAS-2002 ·/)).toBeInTheDocument()
    expect(screen.getByText(/CAS-2003 ·/)).toBeInTheDocument()
  })

  it('falls back to "Untitled" for a case with no title', async () => {
    client.team.get.mockResolvedValue(single(makeContact()))
    client.team.list.mockResolvedValue(paginated<Case>([makeCase({ title: '', ticketnumber: '' })]))
    renderPage()
    expect(await screen.findByText('Untitled')).toBeInTheDocument()
  })

  it('shows the empty-cases message when the colleague has none', async () => {
    client.team.get.mockResolvedValue(single(makeContact()))
    client.team.list.mockResolvedValue(paginated<Case>([]))
    renderPage()
    expect(await screen.findByText('No support cases raised by this colleague.')).toBeInTheDocument()
  })

  it('shows the cases loading placeholder while cases load', async () => {
    client.team.get.mockResolvedValue(single(makeContact()))
    client.team.list.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(await screen.findByText('Loading cases…')).toBeInTheDocument()
  })

  it('renders prev/next arrows and steps to the next colleague', async () => {
    const user = userEvent.setup()
    client.team.get.mockResolvedValue(single(makeContact()))
    renderPage('/company/p1', { ids: ['p1', 'p2'], from: '/company' })
    await screen.findByRole('heading', { name: 'Ada Lovelace' })

    const prev = screen.getByRole('button', { name: 'Previous' })
    const next = screen.getByRole('button', { name: 'Next' })
    expect(prev).toBeDisabled()
    expect(next).toBeEnabled()

    client.team.get.mockResolvedValue(single(makeContact({ fullname: 'Grace Hopper' })))
    await user.click(next)
    expect(await screen.findByRole('heading', { name: 'Grace Hopper' })).toBeInTheDocument()
  })

  it('does not render nav arrows without list context', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Ada Lovelace' })
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })
})
