import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../test/render'
import { ProfilePage } from './ProfilePage'

// ProfilePage's own job is the header/subtitle and the multi-company banner; the
// embedded ContactProfile has its own tests, so stub it to a marker.
vi.mock('../components/ContactProfile', () => ({
  ContactProfile: () => <div data-testid="contact-profile" />,
}))

const { useMyCompany } = vi.hoisted(() => ({ useMyCompany: vi.fn() }))
vi.mock('../hooks/useMyCompany', () => ({ useMyCompany }))

const { useSelectedCompany } = vi.hoisted(() => ({ useSelectedCompany: vi.fn() }))
vi.mock('../context/SelectedCompanyContext', () => ({ useSelectedCompany }))

function setCompany(name: string | undefined) {
  useMyCompany.mockReturnValue({
    account: name ? { name } : null,
    loading: false,
    error: null,
  })
}

function setSelected(hasMultiple: boolean) {
  useSelectedCompany.mockReturnValue({ hasMultiple })
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setCompany('Acme Ltd')
    setSelected(false)
  })

  it('always renders the title and the embedded contact profile', () => {
    renderWithProviders(<ProfilePage />)
    expect(screen.getByRole('heading', { name: 'My profile' })).toBeInTheDocument()
    expect(screen.getByTestId('contact-profile')).toBeInTheDocument()
  })

  it('names the company in the subtitle when the account is known', () => {
    setCompany('Acme Ltd')
    renderWithProviders(<ProfilePage />)
    expect(screen.getByText('Your contact details at Acme Ltd')).toBeInTheDocument()
  })

  it('shows the generic subtitle when there is no company yet', () => {
    setCompany(undefined)
    renderWithProviders(<ProfilePage />)
    expect(screen.getByText('View and update your contact details.')).toBeInTheDocument()
  })

  it('shows the per-company banner when the user belongs to several companies', () => {
    setCompany('Acme Ltd')
    setSelected(true)
    renderWithProviders(<ProfilePage />)
    expect(screen.getByText(/You have a separate profile for each company/)).toBeInTheDocument()
    // The company name is emphasised inside the banner.
    expect(screen.getAllByText('Acme Ltd').length).toBeGreaterThan(0)
  })

  it('hides the multi-company banner for a single-company user', () => {
    setCompany('Acme Ltd')
    setSelected(false)
    renderWithProviders(<ProfilePage />)
    expect(screen.queryByText(/You have a separate profile for each company/)).not.toBeInTheDocument()
  })

  it('hides the banner when the user has multiple companies but no company loaded yet', () => {
    setCompany(undefined)
    setSelected(true)
    renderWithProviders(<ProfilePage />)
    expect(screen.queryByText(/You have a separate profile for each company/)).not.toBeInTheDocument()
  })
})
