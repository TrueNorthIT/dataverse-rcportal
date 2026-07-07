import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/render'
import type { Contact, EditableContactFields } from '../types/contact'
import { ContactProfile } from './ContactProfile'

/**
 * `ContactProfile` is a thin view over `useMyContact` — every branch (loading,
 * needs-registration, load-failure, the editable form, the marketing toggle) is
 * driven by that hook's return value, so we point the mock and assert on what
 * the user sees / does. This keeps the tests behavioural and refactor-proof.
 */

interface HookState {
  contact: Contact | null
  loading: boolean
  saving: boolean
  error: string | null
  needsRegistration: boolean
  refresh: () => void
  save: (patch: Partial<EditableContactFields>) => Promise<void>
  register: (names?: { firstname?: string; lastname?: string }) => Promise<void>
}

const save = vi.fn<(patch: Partial<EditableContactFields>) => Promise<void>>()
const register = vi.fn<
  (names?: { firstname?: string; lastname?: string }, companyId?: string) => Promise<void>
>()
const refresh = vi.fn()

let state: HookState

vi.mock('../hooks/useMyContact', () => ({
  useMyContact: () => state,
}))

/** Domain-matched companies offered by the registration picker. */
let registrable: {
  companies: { companyId: string; name: string | null }[]
  mustChoose: boolean
  loading: boolean
}

vi.mock('../hooks/useRegistrableCompanies', () => ({
  useRegistrableCompanies: () => registrable,
}))

/** Build a hook-state envelope, defaulting to a happy loaded contact. */
function hookState(over: Partial<HookState> = {}): HookState {
  return {
    contact: null,
    loading: false,
    saving: false,
    error: null,
    needsRegistration: false,
    refresh,
    save,
    register,
    ...over,
  }
}

/** A fully-populated contact record for the editable-form tests. */
function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    contactid: 'c1',
    fullname: 'Ada Lovelace',
    emailaddress1: 'ada@acme.com',
    firstname: 'Ada',
    lastname: 'Lovelace',
    telephone1: '01234 567890',
    mobilephone: '07000 000000',
    jobtitle: 'Analyst',
    address1_line1: '1 Bridge St',
    address1_city: 'London',
    address1_postalcode: 'EC1',
    address1_country: 'UK',
    donotbulkemail: false,
    ...over,
  } as Contact
}

describe('ContactProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    save.mockResolvedValue(undefined)
    register.mockResolvedValue(undefined)
    state = hookState()
    registrable = { companies: [], mustChoose: false, loading: false }
  })

  it('shows a loading message while the contact loads', () => {
    state = hookState({ loading: true })
    renderWithProviders(<ContactProfile />)
    expect(screen.getByText('Loading your details…')).toBeInTheDocument()
  })

  describe('needs registration', () => {
    it('offers to create a contact and calls register on click', async () => {
      const user = userEvent.setup()
      state = hookState({ needsRegistration: true })
      renderWithProviders(<ContactProfile />)

      expect(
        screen.getByText("You don't have a contact record yet."),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Create my contact' }))
      expect(register).toHaveBeenCalledTimes(1)
    })

    it('shows a spinner label and disables the button while saving', () => {
      state = hookState({ needsRegistration: true, saving: true })
      renderWithProviders(<ContactProfile />)

      const button = screen.getByRole('button', { name: 'Creating…' })
      expect(button).toBeDisabled()
    })

    it('surfaces a registration error under the button', () => {
      state = hookState({ needsRegistration: true, error: 'register failed' })
      renderWithProviders(<ContactProfile />)
      expect(screen.getByText('register failed')).toBeInTheDocument()
    })

    it('shows a checking message while the company lookup loads', () => {
      state = hookState({ needsRegistration: true })
      registrable = { companies: [], mustChoose: false, loading: true }
      renderWithProviders(<ContactProfile />)
      expect(
        screen.getByText('Checking which companies match your email…'),
      ).toBeInTheDocument()
    })

    it('notes the single matching company and registers without an explicit pick', async () => {
      const user = userEvent.setup()
      state = hookState({ needsRegistration: true })
      registrable = {
        companies: [{ companyId: 'acc-1', name: 'Acme Ltd' }],
        mustChoose: false,
        loading: false,
      }
      renderWithProviders(<ContactProfile />)

      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Create my contact' }))
      // No companyId needed — the API auto-links a single match itself.
      expect(register).toHaveBeenCalledWith(undefined, undefined)
    })

    it('requires a pick when several companies match, then registers with it', async () => {
      const user = userEvent.setup()
      state = hookState({ needsRegistration: true })
      registrable = {
        companies: [
          { companyId: 'acc-1', name: 'Acme Ltd' },
          { companyId: 'acc-2', name: 'Globex Inc' },
        ],
        mustChoose: true,
        loading: false,
      }
      renderWithProviders(<ContactProfile />)

      // Button starts disabled until a company is chosen.
      const button = screen.getByRole('button', { name: 'Create my contact' })
      expect(button).toBeDisabled()
      expect(screen.getByText('Select a company to continue.')).toBeInTheDocument()

      await user.click(screen.getByRole('radio', { name: 'Globex Inc' }))
      const joinButton = screen.getByRole('button', { name: 'Join Globex Inc' })
      expect(joinButton).toBeEnabled()

      await user.click(joinButton)
      expect(register).toHaveBeenCalledWith(undefined, 'acc-2')
    })
  })

  describe('load failure (no contact, not registration)', () => {
    it('shows the hook error message when present', () => {
      state = hookState({ contact: null, error: 'network down' })
      renderWithProviders(<ContactProfile />)
      expect(screen.getByText('network down')).toBeInTheDocument()
    })

    it('shows a generic fallback message when there is no error', () => {
      state = hookState({ contact: null, error: null })
      renderWithProviders(<ContactProfile />)
      expect(screen.getByText('Could not load your contact.')).toBeInTheDocument()
    })
  })

  describe('loaded profile form', () => {
    it('renders the identity header and email', () => {
      state = hookState({ contact: makeContact() })
      renderWithProviders(<ContactProfile />)

      expect(
        screen.getByRole('heading', { name: 'Ada Lovelace' }),
      ).toBeInTheDocument()
      expect(screen.getByText('ada@acme.com')).toBeInTheDocument()
    })

    it('falls back to "Your profile" when the contact has no fullname', () => {
      state = hookState({ contact: makeContact({ fullname: '', emailaddress1: '' }) })
      renderWithProviders(<ContactProfile />)

      expect(
        screen.getByRole('heading', { name: 'Your profile' }),
      ).toBeInTheDocument()
      // No email row rendered when emailaddress1 is empty.
      expect(screen.queryByText('ada@acme.com')).not.toBeInTheDocument()
    })

    it('seeds every editable field from the loaded contact', async () => {
      state = hookState({ contact: makeContact() })
      renderWithProviders(<ContactProfile />)

      await waitFor(() =>
        expect(screen.getByLabelText('First name')).toHaveValue('Ada'),
      )
      expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace')
      expect(screen.getByLabelText('Business phone')).toHaveValue('01234 567890')
      expect(screen.getByLabelText('Mobile phone')).toHaveValue('07000 000000')
      expect(screen.getByLabelText('Job title')).toHaveValue('Analyst')
      expect(screen.getByLabelText('Address')).toHaveValue('1 Bridge St')
      expect(screen.getByLabelText('City')).toHaveValue('London')
      expect(screen.getByLabelText('Postcode')).toHaveValue('EC1')
      expect(screen.getByLabelText('Country')).toHaveValue('UK')
    })

    it('seeds fields to empty strings when the contact fields are null/undefined', async () => {
      state = hookState({
        contact: makeContact({
          firstname: undefined,
          lastname: undefined,
          telephone1: undefined,
          mobilephone: undefined,
          jobtitle: undefined,
          address1_line1: undefined,
          address1_city: undefined,
          address1_postalcode: undefined,
          address1_country: undefined,
        }),
      })
      renderWithProviders(<ContactProfile />)

      await waitFor(() =>
        expect(screen.getByLabelText('First name')).toHaveValue(''),
      )
      expect(screen.getByLabelText('Country')).toHaveValue('')
    })

    it('lets the user edit a field and submits the draft on save', async () => {
      const user = userEvent.setup()
      state = hookState({ contact: makeContact() })
      renderWithProviders(<ContactProfile />)

      const first = await screen.findByLabelText('First name')
      await user.clear(first)
      await user.type(first, 'Grace')
      expect(first).toHaveValue('Grace')

      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
      expect(save.mock.calls[0][0]).toMatchObject({
        firstname: 'Grace',
        lastname: 'Lovelace',
      })
    })

    it('swallows a save rejection so the form does not crash', async () => {
      const user = userEvent.setup()
      save.mockRejectedValueOnce(new Error('save boom'))
      state = hookState({ contact: makeContact() })
      renderWithProviders(<ContactProfile />)

      await screen.findByLabelText('First name')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
      // Still rendered — the rejection was caught.
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    })

    it('shows a saving label and disables the save button while saving', () => {
      state = hookState({ contact: makeContact(), saving: true })
      renderWithProviders(<ContactProfile />)

      const button = screen.getByRole('button', { name: 'Saving…' })
      expect(button).toBeDisabled()
    })

    it('shows a save error next to the button', () => {
      state = hookState({ contact: makeContact(), error: 'could not save' })
      renderWithProviders(<ContactProfile />)
      expect(screen.getByText('could not save')).toBeInTheDocument()
    })
  })

  describe('communication preferences toggle', () => {
    it('reflects "receiving" when the contact has not opted out', () => {
      state = hookState({ contact: makeContact({ donotbulkemail: false }) })
      renderWithProviders(<ContactProfile />)

      const toggle = screen.getByRole('switch', { name: 'Receive marketing emails' })
      expect(toggle).toHaveAttribute('aria-checked', 'true')
      expect(
        screen.getByText('You’re receiving occasional product news and offers.'),
      ).toBeInTheDocument()
    })

    it('reflects "opted out" when donotbulkemail is true', () => {
      state = hookState({ contact: makeContact({ donotbulkemail: true }) })
      renderWithProviders(<ContactProfile />)

      const toggle = screen.getByRole('switch', { name: 'Receive marketing emails' })
      expect(toggle).toHaveAttribute('aria-checked', 'false')
      expect(
        screen.getByText('You’ve opted out of marketing emails.'),
      ).toBeInTheDocument()
    })

    it('opts out (donotbulkemail:true) when toggled off from receiving', async () => {
      const user = userEvent.setup()
      state = hookState({ contact: makeContact({ donotbulkemail: false }) })
      renderWithProviders(<ContactProfile />)

      await user.click(screen.getByRole('switch', { name: 'Receive marketing emails' }))

      await waitFor(() => expect(save).toHaveBeenCalledWith({ donotbulkemail: true }))
    })

    it('opts back in (donotbulkemail:false) when toggled on from opted-out', async () => {
      const user = userEvent.setup()
      state = hookState({ contact: makeContact({ donotbulkemail: true }) })
      renderWithProviders(<ContactProfile />)

      await user.click(screen.getByRole('switch', { name: 'Receive marketing emails' }))

      await waitFor(() => expect(save).toHaveBeenCalledWith({ donotbulkemail: false }))
    })

    it('swallows a toggle save rejection', async () => {
      const user = userEvent.setup()
      save.mockRejectedValueOnce(new Error('toggle boom'))
      state = hookState({ contact: makeContact({ donotbulkemail: false }) })
      renderWithProviders(<ContactProfile />)

      await user.click(screen.getByRole('switch', { name: 'Receive marketing emails' }))

      await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
      // Component still present after the rejected mutation.
      expect(
        screen.getByRole('switch', { name: 'Receive marketing emails' }),
      ).toBeInTheDocument()
    })

    it('disables the toggle while saving', () => {
      state = hookState({ contact: makeContact(), saving: true })
      renderWithProviders(<ContactProfile />)
      expect(
        screen.getByRole('switch', { name: 'Receive marketing emails' }),
      ).toBeDisabled()
    })
  })
})
