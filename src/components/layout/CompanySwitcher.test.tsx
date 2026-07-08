import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Company } from '@truenorth-it/dataverse-client'
import { makeCompany } from '../../test/dataverse'
import { CompanySwitcher } from './CompanySwitcher'

// The switcher reads everything from this context; drive it per test.
const selectCompany = vi.fn()
let ctx: {
  companies: Company[]
  hasMultiple: boolean
  currentCompany: Company | undefined
  selectCompany: (id: string | undefined) => void
}
vi.mock('../../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ctx,
}))

const acme = makeCompany({ contactid: 'c1', companyName: 'Acme Ltd', isDefault: true })
const globex = makeCompany({
  contactid: 'c2',
  companyName: 'Globex Group',
  isDefault: false,
  isCurrent: false,
})

function multiCompanyCtx(over: Partial<typeof ctx> = {}) {
  return {
    companies: [acme, globex],
    hasMultiple: true,
    currentCompany: acme,
    selectCompany,
    ...over,
  }
}

describe('CompanySwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx = multiCompanyCtx()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing for the common single-company case', () => {
    ctx = multiCompanyCtx({ hasMultiple: false })
    const { container } = render(<CompanySwitcher />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the current company name on the chip when multi-company', () => {
    render(<CompanySwitcher />)
    const trigger = screen.getByRole('button', { name: /Acme Ltd/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('opens the switcher menu listing every company', async () => {
    const user = userEvent.setup()
    render(<CompanySwitcher />)

    await user.click(screen.getByRole('button', { name: /Acme Ltd/ }))

    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Switch company')).toBeInTheDocument()
    const items = within(menu).getAllByRole('menuitemradio')
    expect(items).toHaveLength(2)
    // The current company is checked; the other is not.
    expect(items[0]).toHaveAttribute('aria-checked', 'true')
    expect(items[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('selecting a different company calls selectCompany and closes the menu', async () => {
    const user = userEvent.setup()
    render(<CompanySwitcher />)
    await user.click(screen.getByRole('button', { name: /Acme Ltd/ }))

    const globexItem = screen.getByRole('menuitemradio', { name: /Globex Group/ })
    await user.click(globexItem)

    expect(selectCompany).toHaveBeenCalledWith('c2')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('toggles the menu closed on a second trigger click', async () => {
    const user = userEvent.setup()
    render(<CompanySwitcher />)
    const trigger = screen.getByRole('button', { name: /Acme Ltd/ })

    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on outside pointerdown', async () => {
    const user = userEvent.setup()
    render(
      <>
        <CompanySwitcher />
        <button type="button">elsewhere</button>
      </>,
    )
    await user.click(screen.getByRole('button', { name: /Acme Ltd/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button', { name: 'elsewhere' }) })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<CompanySwitcher />)
    await user.click(screen.getByRole('button', { name: /Acme Ltd/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('falls back to fullname when a company has no companyName', async () => {
    const noName = makeCompany({
      contactid: 'c3',
      companyName: undefined,
      fullname: 'Ada Lovelace',
    })
    ctx = multiCompanyCtx({ companies: [acme, noName], currentCompany: noName })
    const user = userEvent.setup()
    render(<CompanySwitcher />)

    // Trigger label uses fullname when companyName is missing.
    await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }))
    expect(screen.getByRole('menuitemradio', { name: /Ada Lovelace/ })).toBeInTheDocument()
  })

  it('falls back to "Select company" when neither name is present', () => {
    const nameless = makeCompany({ contactid: 'c4', companyName: undefined, fullname: undefined })
    ctx = multiCompanyCtx({ companies: [nameless, globex], currentCompany: nameless })
    render(<CompanySwitcher />)
    expect(screen.getByRole('button', { name: /Select company/ })).toBeInTheDocument()
  })

  it('renders a monogram avatar for each company (aria-hidden)', async () => {
    const user = userEvent.setup()
    render(<CompanySwitcher />)
    await user.click(screen.getByRole('button', { name: /Acme Ltd/ }))
    // Avatar spans are decorative -> aria-hidden. One on the trigger + one per
    // item. The open menu renders through a body portal (AnchoredMenu), so
    // count across the document rather than the render container.
    const avatars = document.body.querySelectorAll('span[aria-hidden="true"]')
    expect(avatars.length).toBeGreaterThanOrEqual(3)
  })
})
