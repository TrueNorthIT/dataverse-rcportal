import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { createClient, getToken } = vi.hoisted(() => ({
  createClient: vi.fn((config: unknown) => ({ config })),
  getToken: async () => 'tok',
}))
vi.mock('@truenorth-it/dataverse-client', () => ({ createClient }))
vi.mock('./getToken', () => ({ useGetToken: () => getToken }))

let selectedCompanyId: string | undefined
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({ selectedCompanyId }),
}))

import { useDataverseClient, publicClient } from './client'

describe('useDataverseClient', () => {
  beforeEach(() => {
    createClient.mockClear()
    selectedCompanyId = undefined
  })

  it('builds a client bound to the origin, scope and token', () => {
    renderHook(() => useDataverseClient())
    expect(createClient).toHaveBeenCalledWith({
      baseUrl: 'https://api.test.local',
      scope: 'rcportal',
      getToken,
    })
  })

  it('threads the selected companyId in as the company override', () => {
    selectedCompanyId = 'company-42'
    renderHook(() => useDataverseClient())
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-42' }),
    )
  })
})

describe('publicClient', () => {
  it('is a token-less client for pre-sign-in reads', () => {
    expect(publicClient).toBeDefined()
  })
})
