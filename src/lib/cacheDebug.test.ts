import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { _resetCacheDebug, recordCall, useApiDebug, type ApiCall } from './cacheDebug'

// installCacheDebug wraps window.fetch permanently, so these tests drive the
// store through recordCall directly — the same entry point the wrapper uses.

function call(over: Partial<ApiCall> = {}): ApiCall {
  return {
    url: '/api/v2/rc/team/aggregate/case?aggregate=count',
    method: 'GET',
    status: 200,
    cache: null,
    durationMs: 12,
    receivedAt: 1_720_000_000_000,
    ...over,
  }
}

beforeEach(() => _resetCacheDebug())
afterEach(() => _resetCacheDebug())

describe('useApiDebug', () => {
  it('returns the latest matching call and per-endpoint counters', () => {
    recordCall(call({ cache: 'MISS', durationMs: 180, receivedAt: 1 }))
    recordCall(call({ cache: 'HIT', durationMs: 9, receivedAt: 2 }))
    recordCall(call({ url: '/api/v2/rc/team/aggregate/quote?aggregate=count', cache: 'MISS' }))

    const { result } = renderHook(() => useApiDebug('/aggregate/case'))
    expect(result.current.last?.cache).toBe('HIT')
    expect(result.current.last?.durationMs).toBe(9)
    expect(result.current.count).toBe(2)
    expect(result.current.hits).toBe(1)
    expect(result.current.misses).toBe(1)
  })

  it('supports predicate matching (e.g. excluding filtered aggregates)', () => {
    recordCall(call({ url: '/api/v2/rc/team/aggregate/case?aggregate=count' }))
    recordCall(call({ url: '/api/v2/rc/team/aggregate/case?aggregate=count&filter=x', cache: 'HIT' }))

    const { result } = renderHook(() =>
      useApiDebug((u) => u.includes('/aggregate/case') && !u.includes('filter=')),
    )
    expect(result.current.count).toBe(1)
    expect(result.current.last?.cache).toBeNull()
  })

  it('re-renders live when a new call is recorded', () => {
    const { result } = renderHook(() => useApiDebug('/aggregate/case'))
    expect(result.current.count).toBe(0)
    expect(result.current.last).toBeUndefined()

    act(() => recordCall(call({ cache: 'HIT' })))
    expect(result.current.count).toBe(1)
    expect(result.current.last?.cache).toBe('HIT')
  })
})
