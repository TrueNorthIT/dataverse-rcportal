import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient, paginated, single, type MockClient } from '../test/dataverse'
import { CASE_SELECT } from './caseApi'
import type { Contact } from '../types/contact'
import type { Case } from '../types/case'
import {
  COLLEAGUE_DETAIL_SELECT,
  fetchColleague,
  listColleagueCases,
  fetchMyContact,
  updateMyContact,
  registerMyContact,
  fetchWhoami,
} from './contactApi'

describe('contactApi constants', () => {
  it('the colleague detail select carries the read-only profile columns', () => {
    expect(COLLEAGUE_DETAIL_SELECT).toContain('fullname')
    expect(COLLEAGUE_DETAIL_SELECT).toContain('jobtitle')
    expect(COLLEAGUE_DETAIL_SELECT).toContain('emailaddress1')
  })
})

describe('fetchColleague', () => {
  it('reads a colleague from the team tier with the detail columns', async () => {
    const client = makeClient()
    const contact: Contact = { contactid: 'col-1', fullname: 'Grace Hopper' }
    client.team.get.mockResolvedValue(single(contact))

    const result = await fetchColleague(client, 'col-1')

    expect(result).toEqual(contact)
    expect(client.team.get).toHaveBeenCalledWith('contact', 'col-1', {
      select: COLLEAGUE_DETAIL_SELECT,
    })
  })
})

describe('listColleagueCases', () => {
  it('lists the colleague\'s recent cases from the team tier, newest first', async () => {
    const client = makeClient()
    const cases: Case[] = [{ incidentid: 'c1' }, { incidentid: 'c2' }]
    client.team.list.mockResolvedValue(paginated(cases))

    const result = await listColleagueCases(client, 'col-1')

    expect(result).toEqual(cases)
    expect(client.team.list).toHaveBeenCalledWith('case', {
      select: CASE_SELECT,
      filter: { field: 'primarycontactid', operator: 'eq', value: 'col-1' },
      orderBy: { field: 'createdon', direction: 'desc' },
      top: 10,
    })
  })
})

describe('fetchMyContact', () => {
  let client: MockClient
  beforeEach(() => {
    client = makeClient()
  })

  it('returns the first (and only) row from a me-scoped list', async () => {
    const me: Contact = { contactid: 'me-1', fullname: 'Ada Lovelace' }
    client.me.list.mockResolvedValue(paginated([me]))

    const result = await fetchMyContact(client)

    expect(result).toEqual(me)
    expect(client.me.list).toHaveBeenCalledWith(
      'contact',
      expect.objectContaining({ top: 1 }),
    )
  })

  it('returns null when the user is authenticated but has no contact yet', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([]))

    const result = await fetchMyContact(client)

    expect(result).toBeNull()
  })
})

describe('updateMyContact', () => {
  it('patches the caller\'s own contact and returns the updated row', async () => {
    const client = makeClient()
    const updated: Contact = { contactid: 'me-1', jobtitle: 'Countess' }
    client.me.update.mockResolvedValue(single(updated))

    const result = await updateMyContact(client, 'me-1', { jobtitle: 'Countess' })

    expect(result).toEqual(updated)
    expect(client.me.update).toHaveBeenCalledWith('contact', 'me-1', { jobtitle: 'Countess' })
  })
})

describe('registerMyContact', () => {
  it('self-provisions with the supplied name fields', async () => {
    const client = makeClient()
    client.me.register.mockResolvedValue({ contactid: 'new-me' })

    const result = await registerMyContact(client, { firstname: 'Ada', lastname: 'Lovelace' })

    expect(result).toEqual({ contactid: 'new-me' })
    expect(client.me.register).toHaveBeenCalledWith({ firstname: 'Ada', lastname: 'Lovelace' })
  })

  it('works with no name argument (idempotent provisioning)', async () => {
    const client = makeClient()
    client.me.register.mockResolvedValue({ contactid: 'new-me' })

    await registerMyContact(client)

    expect(client.me.register).toHaveBeenCalledWith(undefined)
  })
})

describe('fetchWhoami', () => {
  it('returns the caller identity from the me tier', async () => {
    const client = makeClient()
    client.me.whoami.mockResolvedValue({ contactid: 'me-1', accountId: 'acc-1' })

    const result = await fetchWhoami(client)

    expect(result).toEqual({ contactid: 'me-1', accountId: 'acc-1' })
    expect(client.me.whoami).toHaveBeenCalled()
  })
})
