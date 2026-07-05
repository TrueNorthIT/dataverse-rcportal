import { describe, expect, it } from 'vitest'
import { makeClient, single } from '../test/dataverse'
import type { Account } from '../types/account'
import { ACCOUNT_SELECT, COLLEAGUE_SELECT, getAccount } from './accountApi'

describe('accountApi constants', () => {
  it('reads the company profile columns', () => {
    expect(ACCOUNT_SELECT).toContain('accountid')
    expect(ACCOUNT_SELECT).toContain('name')
    expect(ACCOUNT_SELECT).toContain('websiteurl')
  })

  it('reads the directory columns for colleagues', () => {
    expect(COLLEAGUE_SELECT).toContain('contactid')
    expect(COLLEAGUE_SELECT).toContain('fullname')
    expect(COLLEAGUE_SELECT).toContain('emailaddress1')
  })
})

describe('getAccount', () => {
  it('fetches a single account from the me tier with the account columns', async () => {
    const client = makeClient()
    const account: Account = { accountid: 'acc-1', name: 'Acme Ltd' }
    client.me.get.mockResolvedValue(single(account))

    const result = await getAccount(client, 'acc-1')

    expect(result).toEqual(account)
    expect(client.me.get).toHaveBeenCalledWith('account', 'acc-1', { select: ACCOUNT_SELECT })
  })
})
