import { describe, expect, it } from 'vitest'
import { firstNumber, fanCount } from './aggregate'
import { makeClient, count } from '../test/dataverse'

describe('firstNumber', () => {
  it('returns the first numeric value in a row', () => {
    expect(firstNumber({ label: 'x', count: 7 })).toBe(7)
  })

  it('returns null when there is no number or no row', () => {
    expect(firstNumber({ label: 'x' })).toBeNull()
    expect(firstNumber(undefined)).toBeNull()
  })
})

describe('fanCount', () => {
  it('sums the count across every company-scoped client', async () => {
    const a = makeClient()
    const b = makeClient()
    a.team.aggregate.mockResolvedValue(count(3))
    b.team.aggregate.mockResolvedValue(count(5))

    const total = await fanCount([a, b], 'team', 'case', { aggregate: 'count' })

    expect(total).toBe(8)
    expect(a.team.aggregate).toHaveBeenCalledWith('case', { aggregate: 'count' })
  })

  it('ignores a client that errors so one flaky company does not blank the tile', async () => {
    const ok = makeClient()
    const bad = makeClient()
    ok.team.aggregate.mockResolvedValue(count(4))
    bad.team.aggregate.mockRejectedValue(new Error('boom'))

    expect(await fanCount([ok, bad], 'team', 'case', { aggregate: 'count' })).toBe(4)
  })

  it('returns null only when every client errors', async () => {
    const bad = makeClient()
    bad.team.aggregate.mockRejectedValue(new Error('boom'))

    expect(await fanCount([bad], 'team', 'case', { aggregate: 'count' })).toBeNull()
  })
})
