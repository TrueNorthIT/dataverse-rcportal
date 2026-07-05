import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import { paginated, single } from '../test/dataverse'
import type { Case } from '../types/case'
import type { CaseNote } from '../types/caseNote'

// The page resolves its client + selected company through these modules.
// vi.hoisted lifts the client creation above the hoisted vi.mock factories and
// the SUT import so the factory can safely close over it.
const { client } = await vi.hoisted(async () => {
  const { makeClient } = await import('../test/dataverse')
  return { client: makeClient() }
})
vi.mock('../lib/client', () => ({ useDataverseClient: () => client, publicClient: client }))
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({
    selectedContactId: undefined,
    allCompanies: false,
    companies: [],
    hasMultiple: false,
    loading: false,
  }),
}))

// Imported after the mocks so the mocked modules are in place.
const { CaseDetailPage } = await import('./CaseDetailPage')

const FIXED_NOW = '2026-07-05T12:00:00Z'

function makeCase(over: Partial<Case> = {}): Case {
  return {
    incidentid: 'c1',
    title: 'Printer offline',
    ticketnumber: 'CAS-1001',
    prioritycode: 1,
    prioritycode_label: 'High',
    statuscode_label: 'Active',
    description: 'The office printer is offline.',
    createdon: '2026-07-01T09:00:00Z',
    modifiedon: '2026-07-04T09:00:00Z',
    ...over,
  }
}

function makeNote(over: Partial<CaseNote> = {}): CaseNote {
  return {
    annotationid: 'n1',
    subject: 'Engineer assigned',
    notetext: 'Ravi is looking into it.',
    createdon: '2026-07-03T09:00:00Z',
    ...over,
  }
}

/** Render the page under the /cases/:id route with optional list nav state. */
function renderPage(state?: unknown, route = '/cases/c1') {
  return renderWithProviders(<CaseDetailPage />, { path: '/cases/:id', route, state })
}

describe('CaseDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fake only the Date/clock so relativeFromNow/formatDate are deterministic —
    // leave setTimeout/setInterval real so findBy*/waitFor polling still fires.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FIXED_NOW))
    // Sensible defaults — most tests override the case get.
    client.me.get.mockResolvedValue(single(makeCase()))
    client.team.get.mockResolvedValue(single(makeCase()))
    client.me.list.mockResolvedValue(paginated<CaseNote>([]))
    client.team.list.mockResolvedValue(paginated<CaseNote>([]))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading skeleton while the case request is pending', () => {
    client.me.get.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    // The shimmer skeleton is on screen and the case card is not yet resolved.
    expect(container.querySelector('.rc-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Printer offline' })).not.toBeInTheDocument()
  })

  it('renders the resolved case summary, meta and description', async () => {
    client.me.get.mockResolvedValue(single(makeCase()))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Printer offline' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('CAS-1001')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    // The description renders in the editable textarea for own tickets.
    expect(await screen.findByDisplayValue('The office printer is offline.')).toBeInTheDocument()
    // Default (auto) tier probes `me` first.
    expect(client.me.get).toHaveBeenCalledWith('case', 'c1', expect.objectContaining({ select: expect.any(Array) }))
  })

  it('falls back to the "Support case" title when the record has none', async () => {
    client.me.get.mockResolvedValue(single(makeCase({ title: '' })))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Support case' })).toBeInTheDocument()
  })

  it('surfaces an error message when the case fails to load on both tiers', async () => {
    client.me.get.mockRejectedValue(new Error('nope'))
    client.team.get.mockRejectedValue(new Error('kaboom'))
    renderPage()
    expect(await screen.findByText('kaboom')).toBeInTheDocument()
  })

  it('uses the tier hint from list nav and skips the me probe', async () => {
    client.team.get.mockResolvedValue(single(makeCase({ title: "Colleague's ticket" })))
    renderPage({ ids: ['c1'], from: '/cases', tier: 'team' })

    expect(await screen.findByRole('heading', { name: "Colleague's ticket" })).toBeInTheDocument()
    // team-tier read means it's not mine → read-only banner + no editor.
    expect(
      screen.getByText(/one of your company's tickets/i),
    ).toBeInTheDocument()
    expect(client.team.get).toHaveBeenCalled()
    expect(client.me.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('shows the read-only description text (not a textarea) for a company ticket', async () => {
    client.team.get.mockResolvedValue(single(makeCase({ description: '', title: 'Ours' })))
    renderPage({ ids: ['c1'], from: '/cases', tier: 'team' })
    expect(await screen.findByText('No description provided.')).toBeInTheDocument()
  })

  it('does not render prev/next arrows without list nav context', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Printer offline' })
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('enables next but disables prev on the first case, and steps to the next', async () => {
    const user = userEvent.setup()
    client.me.get.mockResolvedValue(single(makeCase()))
    renderPage({ ids: ['c1', 'c2', 'c3'], from: '/cases', tier: 'me' })
    await screen.findByRole('heading', { name: 'Printer offline' })

    const prev = screen.getByRole('button', { name: 'Previous' })
    const next = screen.getByRole('button', { name: 'Next' })
    expect(prev).toBeDisabled()
    expect(next).toBeEnabled()

    client.me.get.mockResolvedValue(single(makeCase({ title: 'Second case' })))
    await user.click(next)
    expect(await screen.findByRole('heading', { name: 'Second case' })).toBeInTheDocument()
  })

  it('disables next on the last case, and steps to the previous', async () => {
    const user = userEvent.setup()
    client.me.get.mockResolvedValue(single(makeCase()))
    renderPage({ ids: ['c0', 'c1'], from: '/cases', tier: 'me' }, '/cases/c1')
    await screen.findByRole('heading', { name: 'Printer offline' })

    const prev = screen.getByRole('button', { name: 'Previous' })
    expect(prev).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    client.me.get.mockResolvedValue(single(makeCase({ title: 'Earlier case' })))
    await user.click(prev)
    expect(await screen.findByRole('heading', { name: 'Earlier case' })).toBeInTheDocument()
  })

  it('renders the notes timeline with subject and body', async () => {
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.list.mockResolvedValue(paginated<CaseNote>([makeNote()]))
    renderPage()

    expect(await screen.findByText('Engineer assigned')).toBeInTheDocument()
    expect(screen.getByText('Ravi is looking into it.')).toBeInTheDocument()
  })

  it('falls back to "Update" for a note without a subject', async () => {
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.list.mockResolvedValue(paginated<CaseNote>([makeNote({ subject: '', notetext: '' })]))
    renderPage()
    expect(await screen.findByText('Update')).toBeInTheDocument()
  })

  it('shows the empty-updates message when there are no notes', async () => {
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.list.mockResolvedValue(paginated<CaseNote>([]))
    renderPage()
    expect(await screen.findByText('No updates on this ticket yet.')).toBeInTheDocument()
  })

  it('shows the notes skeleton while notes load (case already resolved)', async () => {
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.list.mockReturnValue(new Promise(() => {}))
    renderPage()
    await screen.findByRole('heading', { name: 'Printer offline' })
    expect(screen.getByLabelText('Loading updates')).toBeInTheDocument()
  })

  it('saves an edited description via me.update on an own ticket', async () => {
    const user = userEvent.setup()
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.update.mockResolvedValue(single({}))
    renderPage()

    const textarea = await screen.findByDisplayValue('The office printer is offline.')
    const saveBtn = screen.getByRole('button', { name: 'Save changes' })
    // Nothing changed yet → save is disabled.
    expect(saveBtn).toBeDisabled()

    await user.type(textarea, ' Rebooted.')
    expect(saveBtn).toBeEnabled()
    await user.click(saveBtn)

    await waitFor(() =>
      expect(client.me.update).toHaveBeenCalledWith(
        'case',
        'c1',
        expect.objectContaining({ description: 'The office printer is offline. Rebooted.' }),
      ),
    )
    // Button flips back out of the pending state once the mutation settles.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument(),
    )
  })

  it('shows a save error message when the description update fails', async () => {
    const user = userEvent.setup()
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.update.mockRejectedValue(new Error('save failed'))
    renderPage()

    const textarea = await screen.findByDisplayValue('The office printer is offline.')
    await user.type(textarea, ' more')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/Couldn.t save/)).toBeInTheDocument()
  })

  it('posts a note via me.create and clears the compose box', async () => {
    const user = userEvent.setup()
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.create.mockResolvedValue(single({}))
    renderPage()

    await screen.findByRole('heading', { name: 'Printer offline' })
    const compose = screen.getByPlaceholderText('Add an update or reply…')
    const postBtn = screen.getByRole('button', { name: 'Post update' })
    expect(postBtn).toBeDisabled()

    await user.type(compose, 'Any progress?')
    expect(postBtn).toBeEnabled()
    await user.click(postBtn)

    await waitFor(() =>
      expect(client.me.create).toHaveBeenCalledWith(
        'casenotes',
        expect.objectContaining({ notetext: 'Any progress?', objectid: 'c1' }),
      ),
    )
    await waitFor(() =>
      expect((compose as HTMLTextAreaElement).value).toBe(''),
    )
  })

  it('shows a post error message when the note create fails', async () => {
    const user = userEvent.setup()
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.create.mockRejectedValue(new Error('post failed'))
    renderPage()

    await screen.findByRole('heading', { name: 'Printer offline' })
    const compose = screen.getByPlaceholderText('Add an update or reply…')
    await user.type(compose, 'hello')
    await user.click(screen.getByRole('button', { name: 'Post update' }))

    expect(await screen.findByText(/Couldn.t post/)).toBeInTheDocument()
  })

  it('does not render the note composer for a company (read-only) ticket', async () => {
    client.team.get.mockResolvedValue(single(makeCase()))
    renderPage({ ids: ['c1'], from: '/cases', tier: 'team' })
    await screen.findByRole('heading', { name: 'Printer offline' })
    expect(screen.queryByPlaceholderText('Add an update or reply…')).not.toBeInTheDocument()
  })

  it('navigates back to the list when there is no origin (deep link)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Printer offline' })
    // Just assert the back control is present and clickable without throwing.
    await user.click(screen.getByRole('button', { name: /Support/ }))
  })

  it('steps back in history when arrived from a list (from set)', async () => {
    const user = userEvent.setup()
    renderPage({ ids: ['c1'], from: '/cases', tier: 'me' })
    await screen.findByRole('heading', { name: 'Printer offline' })
    // With `from` set, back uses navigate(-1) — clicking should not throw.
    await user.click(screen.getByRole('button', { name: /Support/ }))
  })

  it('cleans the DEMO marker out of the note body', async () => {
    client.me.get.mockResolvedValue(single(makeCase()))
    client.me.list.mockResolvedValue(
      paginated<CaseNote>([makeNote({ subject: 'Note', notetext: '[DEMO-RCPORTAL]Real update text.' })]),
    )
    renderPage()
    const body = await screen.findByText('Real update text.')
    expect(within(body).queryByText(/DEMO-RCPORTAL/)).not.toBeInTheDocument()
  })
})
