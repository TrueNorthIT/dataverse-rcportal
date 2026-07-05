import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useListControls } from './useListControls'

/** Wrapper mounting the hook under a MemoryRouter seeded with `initialUrl`. */
function makeWrapper(initialUrl: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  )
}

/** Render the hook plus the live location so tests can assert the URL query. */
function renderControls(initialUrl: string, defaultFilter = 'all', defaultSort = 'recent') {
  return renderHook(
    () => ({
      controls: useListControls(defaultFilter, defaultSort),
      location: useLocation(),
    }),
    { wrapper: makeWrapper(initialUrl) },
  )
}

describe('useListControls', () => {
  it('falls back to the provided defaults when the URL has no params', () => {
    const { result } = renderControls('/projects', 'open', 'name')

    expect(result.current.controls.filter).toBe('open')
    expect(result.current.controls.sort).toBe('name')
  })

  it('reads the filter and sort from the URL query', () => {
    const { result } = renderControls('/projects?f=overdue&s=due')

    expect(result.current.controls.filter).toBe('overdue')
    expect(result.current.controls.sort).toBe('due')
  })

  it('setFilter writes ?f= to the URL and updates the returned filter', () => {
    const { result } = renderControls('/projects', 'all', 'recent')

    act(() => result.current.controls.setFilter('overdue'))

    expect(result.current.controls.filter).toBe('overdue')
    expect(new URLSearchParams(result.current.location.search).get('f')).toBe('overdue')
  })

  it('setSort writes ?s= to the URL and updates the returned sort', () => {
    const { result } = renderControls('/projects', 'all', 'recent')

    act(() => result.current.controls.setSort('name'))

    expect(result.current.controls.sort).toBe('name')
    expect(new URLSearchParams(result.current.location.search).get('s')).toBe('name')
  })

  it('preserves the other param when updating one', () => {
    const { result } = renderControls('/projects?f=overdue&s=due')

    act(() => result.current.controls.setFilter('open'))

    const q = new URLSearchParams(result.current.location.search)
    expect(q.get('f')).toBe('open')
    expect(q.get('s')).toBe('due') // untouched
  })

  it('preserves unrelated query params', () => {
    const { result } = renderControls('/projects?tab=list&f=overdue')

    act(() => result.current.controls.setSort('name'))

    const q = new URLSearchParams(result.current.location.search)
    expect(q.get('tab')).toBe('list')
    expect(q.get('f')).toBe('overdue')
    expect(q.get('s')).toBe('name')
  })

  it('keeps stable setter identities across re-renders', () => {
    const { result, rerender } = renderControls('/projects')
    const firstSetFilter = result.current.controls.setFilter
    const firstSetSort = result.current.controls.setSort

    rerender()

    expect(result.current.controls.setFilter).toBe(firstSetFilter)
    expect(result.current.controls.setSort).toBe(firstSetSort)
  })
})
