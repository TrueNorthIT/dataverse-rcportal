import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useListNav, type ListNavState } from './useListNav'

interface Entry {
  pathname: string
  state?: ListNavState
}

/** Mount the hook under a MemoryRouter seeded with `entries` (last is current). */
function makeWrapper(entries: Entry[], initialIndex?: number) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex ?? entries.length - 1}>
      {children}
    </MemoryRouter>
  )
}

/** Render the hook plus the live location so tests can assert navigation. */
function renderNav(basePath: string, id: string | undefined, entries: Entry[], initialIndex?: number) {
  return renderHook(
    () => ({
      nav: useListNav(basePath, id),
      location: useLocation(),
    }),
    { wrapper: makeWrapper(entries, initialIndex) },
  )
}

const ids = ['c0', 'c1', 'c2']

describe('useListNav', () => {
  it('resolves prev and next ids from the ordered list', () => {
    const { result } = renderNav('/cases', 'c1', [
      { pathname: '/cases/c1', state: { ids, from: '/cases', tier: 'me' } },
    ])

    expect(result.current.nav.prevId).toBe('c0')
    expect(result.current.nav.nextId).toBe('c2')
    expect(result.current.nav.tier).toBe('me')
  })

  it('has no prevId at the start of the list', () => {
    const { result } = renderNav('/cases', 'c0', [
      { pathname: '/cases/c0', state: { ids } },
    ])

    expect(result.current.nav.prevId).toBeUndefined()
    expect(result.current.nav.nextId).toBe('c1')
  })

  it('has no nextId at the end of the list', () => {
    const { result } = renderNav('/cases', 'c2', [
      { pathname: '/cases/c2', state: { ids } },
    ])

    expect(result.current.nav.prevId).toBe('c1')
    expect(result.current.nav.nextId).toBeUndefined()
  })

  it('returns no neighbours when there is no navigation state', () => {
    const { result } = renderNav('/cases', 'c1', [{ pathname: '/cases/c1' }])

    expect(result.current.nav.prevId).toBeUndefined()
    expect(result.current.nav.nextId).toBeUndefined()
    expect(result.current.nav.tier).toBeUndefined()
  })

  it('returns no neighbours when the id is missing', () => {
    const { result } = renderNav('/cases', undefined, [
      { pathname: '/cases', state: { ids } },
    ])

    expect(result.current.nav.prevId).toBeUndefined()
    expect(result.current.nav.nextId).toBeUndefined()
  })

  it('returns no neighbours when the id is not in the list', () => {
    const { result } = renderNav('/cases', 'zzz', [
      { pathname: '/cases/zzz', state: { ids } },
    ])

    expect(result.current.nav.prevId).toBeUndefined()
    expect(result.current.nav.nextId).toBeUndefined()
  })

  it('goNext navigates to the next id, carrying the nav state', () => {
    const { result } = renderNav('/cases', 'c1', [
      { pathname: '/cases/c1', state: { ids, from: '/cases', tier: 'team' } },
    ])

    act(() => result.current.nav.goNext())

    expect(result.current.location.pathname).toBe('/cases/c2')
    expect(result.current.location.state).toEqual({ ids, from: '/cases', tier: 'team' })
  })

  it('goPrev navigates to the previous id', () => {
    const { result } = renderNav('/cases', 'c1', [
      { pathname: '/cases/c1', state: { ids } },
    ])

    act(() => result.current.nav.goPrev())

    expect(result.current.location.pathname).toBe('/cases/c0')
  })

  it('goNext is a no-op at the end of the list', () => {
    const { result } = renderNav('/cases', 'c2', [
      { pathname: '/cases/c2', state: { ids } },
    ])

    act(() => result.current.nav.goNext())

    expect(result.current.location.pathname).toBe('/cases/c2')
  })

  it('goPrev is a no-op at the start of the list', () => {
    const { result } = renderNav('/cases', 'c0', [
      { pathname: '/cases/c0', state: { ids } },
    ])

    act(() => result.current.nav.goPrev())

    expect(result.current.location.pathname).toBe('/cases/c0')
  })

  it('goBack steps back in history when a "from" origin is present', () => {
    const { result } = renderNav(
      '/cases',
      'c1',
      [
        { pathname: '/cases' },
        { pathname: '/cases/c1', state: { ids, from: '/cases' } },
      ],
      1,
    )

    act(() => result.current.nav.goBack())

    expect(result.current.location.pathname).toBe('/cases')
  })

  it('goBack navigates to the base path when there is no "from"', () => {
    const { result } = renderNav('/cases', 'c1', [
      { pathname: '/cases/c1', state: { ids } },
    ])

    act(() => result.current.nav.goBack())

    expect(result.current.location.pathname).toBe('/cases')
  })
})
