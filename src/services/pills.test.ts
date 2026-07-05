import { describe, expect, it } from 'vitest'
import type { FilterCondition } from '@truenorth-it/dataverse-client'
import type { Pill } from './pills'

/**
 * `pills.ts` is a type-only module (it exports the `Pill` interface and nothing
 * runtime), so there is no behaviour to execute. These tests document the shape
 * the rest of the app relies on: a labelled key with an optional server filter,
 * and the `all` pill carrying no filter.
 */
describe('Pill', () => {
  it('describes a plain labelled pill with no filter', () => {
    const all: Pill = { key: 'all', label: 'All' }
    expect(all.filter).toBeUndefined()
    expect({ key: all.key, label: all.label }).toEqual({ key: 'all', label: 'All' })
  })

  it('accepts a single filter condition', () => {
    const cond: FilterCondition = { field: 'statecode', operator: 'eq', value: 1 }
    const pill: Pill = { key: 'active', label: 'Active', filter: cond }
    expect(pill.filter).toEqual(cond)
    expect(Array.isArray(pill.filter)).toBe(false)
  })

  it('accepts an array of AND-ed filter conditions', () => {
    const conds: FilterCondition[] = [
      { field: 'msdyn_finish', operator: 'gt', value: '2026-08-04' },
      { field: 'msdyn_actualend', operator: 'eq', value: 'null' },
    ]
    const pill: Pill = { key: 'ontrack', label: 'On track', filter: conds }
    expect(Array.isArray(pill.filter)).toBe(true)
    expect(pill.filter).toHaveLength(2)
  })
})
