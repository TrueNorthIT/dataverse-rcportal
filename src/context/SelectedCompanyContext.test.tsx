import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { companiesResponse, makeCompany } from '../test/dataverse'
import { SelectedCompanyProvider, useSelectedCompany } from './SelectedCompanyContext'

const { companiesFn } = vi.hoisted(() => ({ companiesFn: vi.fn() }))
vi.mock('@truenorth-it/dataverse-client', () => ({
  createClient: () => ({ me: { companies: companiesFn } }),
}))
vi.mock('../lib/getToken', () => ({ useGetToken: () => async () => 'tok' }))
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: { getActiveAccount: () => ({ homeAccountId: 'h1' }) },
    accounts: [],
  }),
}))

const KEY = 'rcportal.selectedCompanyId.h1'
const wrapper = ({ children }: { children: ReactNode }) => (
  <SelectedCompanyProvider>{children}</SelectedCompanyProvider>
)

function renderContext() {
  return renderHook(() => useSelectedCompany(), { wrapper })
}

describe('SelectedCompanyProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    companiesFn.mockResolvedValue(companiesResponse([makeCompany()]))
  })

  it('loads the caller companies and resolves the default as current', async () => {
    const { result } = renderContext()
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.companies).toHaveLength(1)
    expect(result.current.hasMultiple).toBe(false)
    expect(result.current.currentCompany?.contactid).toBe('contact-1')
  })

  it('flags hasMultiple when the caller is a contact under several companies', async () => {
    companiesFn.mockResolvedValue(
      companiesResponse([
        makeCompany({ contactid: 'c1', companyName: 'Acme', isDefault: true }),
        makeCompany({ contactid: 'c2', companyName: 'Globex', isDefault: false, isCurrent: false }),
      ]),
    )
    const { result } = renderContext()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMultiple).toBe(true)
  })

  it('selectCompany switches the acting company and persists it', async () => {
    companiesFn.mockResolvedValue(
      companiesResponse([
        makeCompany({ contactid: 'c1', isDefault: true }),
        makeCompany({ contactid: 'c2', companyName: 'Globex', isDefault: false, isCurrent: false }),
      ]),
    )
    const { result } = renderContext()
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.selectCompany('c2'))

    expect(result.current.selectedCompanyId).toBe('c2')
    expect(result.current.currentCompany?.contactid).toBe('c2')
    expect(localStorage.getItem(KEY)).toBe('c2')
  })

  it('clearing the selection removes the persisted key', async () => {
    localStorage.setItem(KEY, 'c2')
    companiesFn.mockResolvedValue(
      companiesResponse([
        makeCompany({ contactid: 'c1', isDefault: true }),
        makeCompany({ contactid: 'c2', isDefault: false }),
      ]),
    )
    const { result } = renderContext()
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.selectCompany(undefined))
    expect(result.current.selectedCompanyId).toBeUndefined()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('selectAllCompanies turns on the roll-up and persists the ALL sentinel', async () => {
    const { result } = renderContext()
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.selectAllCompanies())
    expect(result.current.allCompanies).toBe(true)
    expect(localStorage.getItem(KEY)).toBe('ALL')
  })

  it('restores the ALL roll-up from storage on mount', async () => {
    localStorage.setItem(KEY, 'ALL')
    const { result } = renderContext()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.allCompanies).toBe(true)
  })

  it('drops a persisted selection that is no longer one of the caller companies', async () => {
    localStorage.setItem(KEY, 'stale-contact')
    companiesFn.mockResolvedValue(companiesResponse([makeCompany({ contactid: 'c1' })]))
    const { result } = renderContext()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.selectedCompanyId).toBeUndefined()
  })

  it('survives a failed companies() call with an empty list', async () => {
    companiesFn.mockRejectedValue(new Error('offline'))
    const { result } = renderContext()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.companies).toEqual([])
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useSelectedCompany())).toThrow(
      /must be used within a SelectedCompanyProvider/,
    )
  })
})
