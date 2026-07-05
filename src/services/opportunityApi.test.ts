import { describe, expect, it } from 'vitest'
import type { Opportunity } from '../types/dataverse.generated'
import { OPP_SUMMARY_SELECT, fetchOpportunitySummary } from './opportunityApi'
import { makeClient, single } from '../test/dataverse'

describe('OPP_SUMMARY_SELECT', () => {
  it('covers the summary-card columns', () => {
    expect(OPP_SUMMARY_SELECT).toEqual([
      'opportunityid',
      'name',
      'estimatedvalue',
      'estimatedclosedate',
      'statuscode',
    ])
  })
})

describe('fetchOpportunitySummary', () => {
  it('reads the me tier when the caller is on a mine record', async () => {
    const client = makeClient()
    const opp: Opportunity = { opportunityid: 'o1', name: 'Expansion' }
    client.me.get.mockResolvedValue(single(opp))

    const out = await fetchOpportunitySummary(client, 'o1', true)

    expect(out).toEqual(opp)
    expect(client.me.get).toHaveBeenCalledWith('opportunity', 'o1', { select: OPP_SUMMARY_SELECT })
    expect(client.team.get).not.toHaveBeenCalled()
  })

  it('reads the team tier when the caller is not on a mine record', async () => {
    const client = makeClient()
    const opp: Opportunity = { opportunityid: 'o2', name: 'Renewal' }
    client.team.get.mockResolvedValue(single(opp))

    const out = await fetchOpportunitySummary(client, 'o2', false)

    expect(out).toEqual(opp)
    expect(client.team.get).toHaveBeenCalledWith('opportunity', 'o2', { select: OPP_SUMMARY_SELECT })
    expect(client.me.get).not.toHaveBeenCalled()
  })

  it('falls back to the team tier when the preferred tier throws', async () => {
    const client = makeClient()
    client.me.get.mockRejectedValue(new Error('403'))
    const opp: Opportunity = { opportunityid: 'o3' }
    client.team.get.mockResolvedValue(single(opp))

    const out = await fetchOpportunitySummary(client, 'o3', true)

    expect(out).toEqual(opp)
    expect(client.me.get).toHaveBeenCalledTimes(1)
    expect(client.team.get).toHaveBeenCalledWith('opportunity', 'o3', { select: OPP_SUMMARY_SELECT })
  })

  it('does not double-call team when team was already the preferred tier and it throws', async () => {
    const client = makeClient()
    // preferred (team) throws, fallback (team) also throws → null.
    client.team.get.mockRejectedValue(new Error('boom'))

    const out = await fetchOpportunitySummary(client, 'o4', false)

    expect(out).toBeNull()
    expect(client.team.get).toHaveBeenCalledTimes(2)
  })

  it('returns null when the record is unreadable at both tiers (optional dressing)', async () => {
    const client = makeClient()
    client.me.get.mockRejectedValue(new Error('403'))
    client.team.get.mockRejectedValue(new Error('403'))

    const out = await fetchOpportunitySummary(client, 'o5', true)

    expect(out).toBeNull()
    expect(client.me.get).toHaveBeenCalledTimes(1)
    expect(client.team.get).toHaveBeenCalledTimes(1)
  })
})
