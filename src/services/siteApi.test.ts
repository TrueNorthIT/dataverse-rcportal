import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient, single, type MockClient } from '../test/dataverse'
import type { Site } from '../types/site'
import {
  SITE_SELECT,
  SITE_DETAIL_SELECT,
  SITE_ORDER,
  CONNECTIVITY_LABELS,
  buildSitePills,
  fetchSiteDetail,
} from './siteApi'

describe('siteApi constants', () => {
  it('the detail select is a superset of the list select with the richer columns', () => {
    for (const col of SITE_SELECT) expect(SITE_DETAIL_SELECT).toContain(col)
    expect(SITE_DETAIL_SELECT).toContain('latitude')
    expect(SITE_DETAIL_SELECT).toContain('longitude')
    expect(SITE_DETAIL_SELECT).toContain('telephone1')
  })

  it('orders the list alphabetically by name', () => {
    expect(SITE_ORDER).toEqual({ field: 'name', direction: 'asc' })
  })
})

describe('buildSitePills', () => {
  it('starts with the "all" pill then one pill per connectivity label', () => {
    const pills = buildSitePills()
    expect(pills[0]).toEqual({ key: 'all', label: 'All' })
    expect(pills).toHaveLength(CONNECTIVITY_LABELS.length + 1)
  })

  it('maps each label to the real choice value (100000000 + index)', () => {
    const pills = buildSitePills()
    CONNECTIVITY_LABELS.forEach((label, i) => {
      const pill = pills.find((p) => p.key === label)
      expect(pill).toEqual({
        key: label,
        label,
        filter: { field: 'new_connectivitytype', operator: 'eq', value: 100000000 + i },
      })
    })
  })

  it('never carries a filter on the "all" pill', () => {
    expect(buildSitePills().find((p) => p.key === 'all')?.filter).toBeUndefined()
  })
})

describe('fetchSiteDetail', () => {
  let client: MockClient
  beforeEach(() => {
    client = makeClient()
  })

  it('honours a "team" preferTier and marks the record as not mine', async () => {
    client.team.get.mockResolvedValue(single<Site>({ customeraddressid: 's1' }))

    const result = await fetchSiteDetail(client, 's1', 'team')

    expect(result).toEqual({ record: { customeraddressid: 's1' }, mine: false })
    expect(client.team.get).toHaveBeenCalledWith('site', 's1', { select: SITE_DETAIL_SELECT })
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('honours a "me" preferTier and marks the record as mine', async () => {
    client.me.get.mockResolvedValue(single<Site>({ customeraddressid: 's2' }))

    const result = await fetchSiteDetail(client, 's2', 'me')

    expect(result).toEqual({ record: { customeraddressid: 's2' }, mine: true })
    expect(client.me.get).toHaveBeenCalledWith('site', 's2', { select: SITE_DETAIL_SELECT })
    expect(client.team.get).not.toHaveBeenCalled()
  })

  it('without a hint, reads from "team" first (sites are company-level)', async () => {
    client.team.get.mockResolvedValue(single<Site>({ customeraddressid: 's3' }))

    const result = await fetchSiteDetail(client, 's3')

    expect(result).toEqual({ record: { customeraddressid: 's3' }, mine: false })
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('falls back to "me" when the "team" read throws', async () => {
    client.team.get.mockRejectedValue(new Error('403'))
    client.me.get.mockResolvedValue(single<Site>({ customeraddressid: 's4' }))

    const result = await fetchSiteDetail(client, 's4')

    expect(result).toEqual({ record: { customeraddressid: 's4' }, mine: true })
    expect(client.team.get).toHaveBeenCalled()
    expect(client.me.get).toHaveBeenCalledWith('site', 's4', { select: SITE_DETAIL_SELECT })
  })
})
