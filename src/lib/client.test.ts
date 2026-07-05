import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { createClient, getToken } = vi.hoisted(() => ({
  createClient: vi.fn((config: unknown) => ({ config })),
  getToken: async () => 'tok',
}))
vi.mock('@truenorth-it/dataverse-client', () => ({ createClient }))
vi.mock('./getToken', () => ({ useGetToken: () => getToken }))

let selectedContactId: string | undefined
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => ({ selectedContactId }),
}))

import { useDataverseClient, publicClient } from './client'

describe('useDataverseClient', () => {
  beforeEach(() => {
    createClient.mockClear()
    selectedContactId = undefined
  })

  it('builds a client bound to the origin, scope and token', () => {
    renderHook(() => useDataverseClient())
    expect(createClient).toHaveBeenCalledWith({
      baseUrl: 'https://api.test.local',
      scope: 'rcportal',
      getToken,
    })
  })

  it('threads the selected contact id in as the company override', () => {
    selectedContactId = 'contact-42'
    renderHook(() => useDataverseClient())
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'contact-42' }),
    )
  })
})

describe('publicClient', () => {
  it('is a token-less client for pre-sign-in reads', () => {
    expect(publicClient).toBeDefined()
  })
})
