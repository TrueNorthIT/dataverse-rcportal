import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { makeClient, single, type MockClient } from '../test/dataverse'
import type { Site } from '../types/site'
import { SiteDetailPage } from './SiteDetailPage'

const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client, publicClient: () => client }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({
    selectedCompanyId: undefined,
    allCompanies: false,
    companies: [],
    hasMultiple: false,
    loading: false,
  }),
}))

const NOW = '2026-07-05T12:00:00Z'

function makeSite(over: Partial<Site> = {}): Site {
  return {
    customeraddressid: 's1',
    name: 'Manchester HQ',
    line1: '1 Deansgate',
    line2: 'Floor 3',
    city: 'Manchester',
    stateorprovince: 'Greater Manchester',
    postalcode: 'M1 1AA',
    country: 'United Kingdom',
    telephone1: '0161 000 0000',
    new_connectivitytype_label: 'Leased Line',
    addresstypecode_label: 'Primary',
    createdon: '2025-11-01T00:00:00Z',
    ...over,
  }
}

function renderPage(opts: { route?: string; state?: unknown } = {}) {
  return renderWithProviders(<SiteDetailPage />, {
    path: '/sites/:id',
    route: opts.route ?? '/sites/s1',
    state: opts.state,
  })
}

describe('SiteDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // shouldAdvanceTime keeps real time flowing (so React Query + waitFor still
    // work) while Date.now() reports the fixed instant used for date formatting.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton while the site is fetching', () => {
    client.team.get.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    // The detail skeleton renders shimmer placeholders and no heading yet.
    expect(container.querySelector('.rc-skeleton')).not.toBeNull()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders an error message when the fetch rejects on both tiers', async () => {
    client.team.get.mockRejectedValue(new Error('team denied'))
    client.me.get.mockRejectedValue(new Error('site not found'))
    renderPage()
    expect(await screen.findByText('site not found')).toBeInTheDocument()
  })

  it('renders the header, connectivity chip and joined full address', async () => {
    client.team.get.mockResolvedValue(single(makeSite()))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Manchester HQ' })).toBeInTheDocument()
    // Connectivity chip in the header trailing slot (also a meta value later).
    expect(screen.getAllByText('Leased Line').length).toBeGreaterThan(0)
    // Full address joins every non-empty part with ", ".
    expect(
      screen.getByText('1 Deansgate, Floor 3, Manchester, Greater Manchester, M1 1AA, United Kingdom'),
    ).toBeInTheDocument()
    // Address-type meta reads "<label> address".
    expect(screen.getByText('Primary address')).toBeInTheDocument()
    // Individual meta values still render.
    expect(screen.getByText('0161 000 0000')).toBeInTheDocument()
    expect(screen.getByText('M1 1AA')).toBeInTheDocument()
  })

  it('falls back to the "Site" title when the name is empty', async () => {
    client.team.get.mockResolvedValue(single(makeSite({ name: '' })))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Site' })).toBeInTheDocument()
  })

  it('omits the connectivity chip when the site has no connectivity type', async () => {
    client.team.get.mockResolvedValue(
      single(makeSite({ new_connectivitytype_label: undefined })),
    )
    renderPage()
    await screen.findByRole('heading', { name: 'Manchester HQ' })
    // Neither the chip nor the "Connectivity" meta value should appear.
    expect(screen.queryByText('Leased Line')).not.toBeInTheDocument()
  })

  it('omits the address-type meta suffix when there is no address type label', async () => {
    client.team.get.mockResolvedValue(single(makeSite({ addresstypecode_label: undefined })))
    renderPage()
    await screen.findByRole('heading', { name: 'Manchester HQ' })
    expect(screen.queryByText(/address$/)).not.toBeInTheDocument()
  })

  it('joins only the populated address parts, skipping blanks', async () => {
    client.team.get.mockResolvedValue(
      single(
        makeSite({
          line1: '5 High Street',
          line2: undefined,
          city: 'Leeds',
          stateorprovince: undefined,
          postalcode: 'LS1 4DL',
          country: undefined,
        }),
      ),
    )
    renderPage()
    expect(await screen.findByText('5 High Street, Leeds, LS1 4DL')).toBeInTheDocument()
  })

  it('honours the tier hint (team) from list state', async () => {
    client.team.get.mockResolvedValue(single(makeSite()))
    renderPage({ route: '/sites/s1', state: { ids: ['s1'], tier: 'team' } })
    await screen.findByRole('heading', { name: 'Manchester HQ' })
    expect(client.team.get).toHaveBeenCalledWith('site', 's1', expect.anything())
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('enables prev/next navigation when list state provides ids', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.get.mockResolvedValue(single(makeSite()))
    renderPage({ route: '/sites/s1', state: { ids: ['s0', 's1', 's2'], from: '/sites', tier: 'team' } })

    await screen.findByRole('heading', { name: 'Manchester HQ' })
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  it('navigates back to the list via the back button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    client.team.get.mockResolvedValue(single(makeSite()))
    renderPage()
    await screen.findByRole('heading', { name: 'Manchester HQ' })
    await user.click(screen.getByRole('button', { name: 'Sites' }))
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Manchester HQ' })).not.toBeInTheDocument(),
    )
  })
})
