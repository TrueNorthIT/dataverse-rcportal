import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CompanyScopeToggle } from './CompanyScopeToggle'

// The toggle reads scope + mutators from the selected-company context; drive it
// through a mutable stub so each test can set the acting company / scope state.
interface CompanyState {
  hasMultiple: boolean
  allCompanies: boolean
  selectedContactId: string | undefined
  selectAllCompanies: ReturnType<typeof vi.fn>
  selectCompany: ReturnType<typeof vi.fn>
}
let company: CompanyState
vi.mock('../../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => company,
}))

function makeState(over: Partial<CompanyState> = {}): CompanyState {
  return {
    hasMultiple: true,
    allCompanies: false,
    selectedContactId: 'c1',
    selectAllCompanies: vi.fn(),
    selectCompany: vi.fn(),
    ...over,
  }
}

describe('CompanyScopeToggle', () => {
  beforeEach(() => {
    company = makeState()
  })

  it('is hidden for single-company users', () => {
    company = makeState({ hasMultiple: false })
    const { container } = render(<CompanyScopeToggle />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders both scope segments for multi-company users', () => {
    render(<CompanyScopeToggle />)
    expect(screen.getByRole('tablist', { name: 'Dashboard scope' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'This company' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All companies' })).toBeInTheDocument()
  })

  it('highlights "This company" when the context is scoped to one company', () => {
    render(<CompanyScopeToggle />)
    expect(screen.getByRole('tab', { name: 'This company' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'All companies' })).toHaveAttribute('aria-selected', 'false')
  })

  it('highlights "All companies" when the context roll-up is on', () => {
    company = makeState({ allCompanies: true })
    render(<CompanyScopeToggle />)
    expect(screen.getByRole('tab', { name: 'All companies' })).toHaveAttribute('aria-selected', 'true')
  })

  describe('with fake timers (debounced commit)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('flips the highlight instantly but defers committing the roll-up', () => {
      render(<CompanyScopeToggle />)

      fireEvent.click(screen.getByRole('tab', { name: 'All companies' }))

      // Highlight is instant.
      expect(screen.getByRole('tab', { name: 'All companies' })).toHaveAttribute('aria-selected', 'true')
      // The expensive commit is still pending (debounced 180ms).
      expect(company.selectAllCompanies).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(180)
      })
      expect(company.selectAllCompanies).toHaveBeenCalledTimes(1)
      expect(company.selectCompany).not.toHaveBeenCalled()
    })

    it('commits back to the selected company id when switching to "This company"', () => {
      company = makeState({ allCompanies: true, selectedContactId: 'c2' })
      render(<CompanyScopeToggle />)

      fireEvent.click(screen.getByRole('tab', { name: 'This company' }))
      act(() => {
        vi.advanceTimersByTime(180)
      })

      expect(company.selectCompany).toHaveBeenCalledTimes(1)
      expect(company.selectCompany).toHaveBeenCalledWith('c2')
      expect(company.selectAllCompanies).not.toHaveBeenCalled()
    })

    it('debounces rapid taps and only commits where you settle', () => {
      render(<CompanyScopeToggle />)

      fireEvent.click(screen.getByRole('tab', { name: 'All companies' }))
      fireEvent.click(screen.getByRole('tab', { name: 'This company' }))
      fireEvent.click(screen.getByRole('tab', { name: 'All companies' }))

      act(() => {
        vi.advanceTimersByTime(180)
      })

      // Only the final resting state commits — the intermediate ones were cleared.
      expect(company.selectAllCompanies).toHaveBeenCalledTimes(1)
      expect(company.selectCompany).not.toHaveBeenCalled()
    })

    it('cancels a pending commit when unmounted', () => {
      const { unmount } = render(<CompanyScopeToggle />)

      fireEvent.click(screen.getByRole('tab', { name: 'All companies' }))
      unmount()
      act(() => {
        vi.advanceTimersByTime(180)
      })

      // The cleanup effect cleared the timer, so nothing committed.
      expect(company.selectAllCompanies).not.toHaveBeenCalled()
    })
  })

  it('re-syncs the highlight when the context scope changes elsewhere', async () => {
    const { rerender } = render(<CompanyScopeToggle />)
    expect(screen.getByRole('tab', { name: 'This company' })).toHaveAttribute('aria-selected', 'true')

    // Simulate the header dropdown flipping the context to all-companies.
    company = makeState({ allCompanies: true })
    rerender(<CompanyScopeToggle />)

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'All companies' })).toHaveAttribute('aria-selected', 'true'),
    )
  })
})
