import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Company } from '@truenorth-it/dataverse-client'
import { makeCompany } from '../test/dataverse'

// createClient just builds an object; we spy on it to see what each per-company
// client is bound to. A getToken function threaded through unchanged.
const { createClient, getToken } = vi.hoisted(() => ({
  createClient: vi.fn((config: unknown) => ({ config })),
  getToken: async () => 'tok',
}))
vi.mock('@truenorth-it/dataverse-client', () => ({ createClient }))
vi.mock('../lib/getToken', () => ({ useGetToken: () => getToken }))

let companies: Company[] = []
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({ companies }),
}))

import { useCompanyClients } from './useCompanyClients'

describe('useCompanyClients', () => {
  beforeEach(() => {
    createClient.mockClear()
    companies = []
  })

  it('returns an empty list when the caller belongs to no companies', () => {
    const { result } = renderHook(() => useCompanyClients())
    expect(result.current).toEqual([])
    expect(createClient).not.toHaveBeenCalled()
  })

  it('builds one client per company, each bound to that company contact id', () => {
    companies = [
      makeCompany({ contactid: 'c1', companyName: 'One' }),
      makeCompany({ contactid: 'c2', companyName: 'Two', isDefault: false }),
    ]

    const { result } = renderHook(() => useCompanyClients())

    expect(result.current).toHaveLength(2)
    expect(result.current[0].company.contactid).toBe('c1')
    expect(result.current[1].company.contactid).toBe('c2')
    expect(createClient).toHaveBeenCalledTimes(2)
    expect(createClient).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ contactId: 'c1', getToken }),
    )
    expect(createClient).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ contactId: 'c2', getToken }),
    )
  })

  it('binds each client to the resolved origin, scope and token getter', () => {
    companies = [makeCompany({ contactid: 'c1' })]

    renderHook(() => useCompanyClients())

    expect(createClient).toHaveBeenCalledWith({
      baseUrl: 'https://api.test.local',
      scope: 'rcportal',
      getToken,
      contactId: 'c1',
    })
  })

  it('exposes the built client alongside its company', () => {
    companies = [makeCompany({ contactid: 'c1' })]
    const { result } = renderHook(() => useCompanyClients())
    // createClient stub echoes its config back, so we can assert the binding.
    expect(result.current[0].client).toEqual({
      config: expect.objectContaining({ contactId: 'c1' }),
    })
  })

  it('memoises the result while the company list is unchanged', () => {
    companies = [makeCompany({ contactid: 'c1' })]
    const { result, rerender } = renderHook(() => useCompanyClients())
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
    // No extra clients built on a re-render with the same inputs.
    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it('rebuilds when the company list changes', () => {
    companies = [makeCompany({ contactid: 'c1' })]
    const { result, rerender } = renderHook(() => useCompanyClients())
    const first = result.current

    companies = [
      makeCompany({ contactid: 'c1' }),
      makeCompany({ contactid: 'c2', isDefault: false }),
    ]
    rerender()

    expect(result.current).not.toBe(first)
    expect(result.current).toHaveLength(2)
  })
})
