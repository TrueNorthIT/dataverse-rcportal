import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { queryClient } from './queryClient'

describe('queryClient', () => {
  it('is a QueryClient that refetches on focus so Dataverse edits show up', () => {
    expect(queryClient).toBeInstanceOf(QueryClient)
    const defaults = queryClient.getDefaultOptions().queries
    expect(defaults?.refetchOnWindowFocus).toBe('always')
    expect(defaults?.staleTime).toBe(0)
    expect(defaults?.retry).toBe(1)
  })
})
