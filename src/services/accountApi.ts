import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Account } from '../types/account'

/** Columns the portal reads for a company. Keep tight — the API returns only what you ask. */
export const ACCOUNT_SELECT = [
  'accountid',
  'name',
  'telephone1',
  'websiteurl',
  'emailaddress1',
  'address1_line1',
  'address1_city',
  'address1_postalcode',
  'address1_country',
  'createdon',
]

/** Columns for the colleague directory (contact, team tier). */
export const COLLEAGUE_SELECT = [
  'contactid',
  'fullname',
  'jobtitle',
  'emailaddress1',
  'telephone1',
  'mobilephone',
]

/** Fetch a single account by id (used from the Company screen when needed). */
export async function getAccount(
  client: DataverseClient,
  id: string,
): Promise<Account> {
  const res = await client.me.get<Account>('account', id, { select: ACCOUNT_SELECT })
  return res.data
}
