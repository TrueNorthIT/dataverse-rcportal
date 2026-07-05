import { describe, expect, it } from 'vitest'
import type { Quote, QuoteLine } from '../types/quote'
import { QuoteStatecode } from '../types/dataverse.generated'
import {
  QUOTE_PILLS,
  QUOTE_SELECT,
  QUOTE_DETAIL_SELECT,
  QUOTE_LINE_SELECT,
  listQuotesForOpportunity,
  fetchQuoteDetail,
  listQuoteLines,
} from './quoteApi'
import { makeClient, paginated, single } from '../test/dataverse'

describe('QUOTE_PILLS', () => {
  it('starts with a filter-less "all" pill', () => {
    expect(QUOTE_PILLS[0]).toEqual({ key: 'all', label: 'All' })
    expect(QUOTE_PILLS[0].filter).toBeUndefined()
  })

  it('filters Active and Draft by statecode', () => {
    const active = QUOTE_PILLS.find((p) => p.key === 'active')!
    const draft = QUOTE_PILLS.find((p) => p.key === 'draft')!
    expect(active.filter).toEqual({ field: 'statecode', operator: 'eq', value: QuoteStatecode.Active })
    expect(draft.filter).toEqual({ field: 'statecode', operator: 'eq', value: QuoteStatecode.Draft })
  })

  it('exposes exactly all / active / draft in order', () => {
    expect(QUOTE_PILLS.map((p) => p.key)).toEqual(['all', 'active', 'draft'])
  })
})

describe('column sets', () => {
  it('QUOTE_SELECT covers the list columns', () => {
    expect(QUOTE_SELECT).toContain('quoteid')
    expect(QUOTE_SELECT).toContain('totalamount')
    expect(QUOTE_SELECT).toContain('quotenumber')
  })

  it('QUOTE_DETAIL_SELECT extends the list set with detail columns', () => {
    for (const col of QUOTE_SELECT) expect(QUOTE_DETAIL_SELECT).toContain(col)
    expect(QUOTE_DETAIL_SELECT).toContain('effectivefrom')
    expect(QUOTE_DETAIL_SELECT).toContain('opportunityid')
    expect(QUOTE_DETAIL_SELECT).toContain('modifiedon')
  })

  it('QUOTE_LINE_SELECT covers the line-item columns', () => {
    expect(QUOTE_LINE_SELECT).toContain('quotedetailid')
    expect(QUOTE_LINE_SELECT).toContain('priceperunit')
    expect(QUOTE_LINE_SELECT).toContain('extendedamount')
  })
})

describe('listQuotesForOpportunity', () => {
  it('reads me-tier quotes filtered by the opportunity lookup value', async () => {
    const client = makeClient()
    const rows: Quote[] = [{ quoteid: 'q1', name: 'Renewal' }]
    client.me.list.mockResolvedValue(paginated(rows))

    const out = await listQuotesForOpportunity(client, 'opp-1')

    expect(out).toEqual(rows)
    expect(client.me.list).toHaveBeenCalledWith('quote', {
      select: QUOTE_SELECT,
      filter: { field: '_opportunityid_value', operator: 'eq', value: 'opp-1' },
      top: 50,
    })
  })

  it('returns an empty array when the opportunity has no quotes', async () => {
    const client = makeClient()
    client.me.list.mockResolvedValue(paginated<Quote>([]))

    expect(await listQuotesForOpportunity(client, 'opp-2')).toEqual([])
  })
})

describe('fetchQuoteDetail', () => {
  it('honours an explicit "me" tier hint and marks the record mine', async () => {
    const client = makeClient()
    client.me.get.mockResolvedValue(single<Quote>({ quoteid: 'q1', name: 'Mine' }))

    const { record, mine } = await fetchQuoteDetail(client, 'q1', 'me')

    expect(mine).toBe(true)
    expect(record.name).toBe('Mine')
    expect(client.me.get).toHaveBeenCalledWith('quote', 'q1', { select: QUOTE_DETAIL_SELECT })
    expect(client.team.get).not.toHaveBeenCalled()
  })

  it('honours an explicit "team" tier hint and marks the record not-mine', async () => {
    const client = makeClient()
    client.team.get.mockResolvedValue(single<Quote>({ quoteid: 'q2' }))

    const { mine } = await fetchQuoteDetail(client, 'q2', 'team')

    expect(mine).toBe(false)
    expect(client.team.get).toHaveBeenCalledWith('quote', 'q2', { select: QUOTE_DETAIL_SELECT })
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('on a deep link tries me first (mine)', async () => {
    const client = makeClient()
    client.me.get.mockResolvedValue(single<Quote>({ quoteid: 'q3' }))

    const { record, mine } = await fetchQuoteDetail(client, 'q3')

    expect(mine).toBe(true)
    expect(record.quoteid).toBe('q3')
    expect(client.me.get).toHaveBeenCalledTimes(1)
    expect(client.team.get).not.toHaveBeenCalled()
  })

  it('falls back to team when me cannot read it (not mine)', async () => {
    const client = makeClient()
    client.me.get.mockRejectedValue(new Error('404'))
    client.team.get.mockResolvedValue(single<Quote>({ quoteid: 'q4' }))

    const { record, mine } = await fetchQuoteDetail(client, 'q4')

    expect(mine).toBe(false)
    expect(record.quoteid).toBe('q4')
    expect(client.me.get).toHaveBeenCalledTimes(1)
    expect(client.team.get).toHaveBeenCalledWith('quote', 'q4', { select: QUOTE_DETAIL_SELECT })
  })
})

describe('listQuoteLines', () => {
  it('reads me-tier lines for a mine quote, oldest-first', async () => {
    const client = makeClient()
    const lines: QuoteLine[] = [{ quotedetailid: 'l1', productdescription: 'Support' }]
    client.me.list.mockResolvedValue(paginated(lines))

    const out = await listQuoteLines(client, 'q1', true)

    expect(out).toEqual(lines)
    expect(client.me.list).toHaveBeenCalledWith('quotedetail', {
      select: QUOTE_LINE_SELECT,
      filter: { field: 'quoteid', operator: 'eq', value: 'q1' },
      orderBy: { field: 'createdon', direction: 'asc' },
      top: 50,
    })
    expect(client.team.list).not.toHaveBeenCalled()
  })

  it('reads team-tier lines for a company quote', async () => {
    const client = makeClient()
    client.team.list.mockResolvedValue(paginated<QuoteLine>([]))

    const out = await listQuoteLines(client, 'q2', false)

    expect(out).toEqual([])
    expect(client.team.list).toHaveBeenCalledTimes(1)
    expect(client.me.list).not.toHaveBeenCalled()
  })
})
