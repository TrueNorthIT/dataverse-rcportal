import type { DataverseClient } from '@truenorth-it/dataverse-client'
import type { Contact, EditableContactFields } from '../types/contact'
import type { Case } from '../types/case'
import { CASE_SELECT } from './caseApi'

/** Richer column set for a colleague's read-only detail view. */
export const COLLEAGUE_DETAIL_SELECT = [
  'contactid',
  'fullname',
  'firstname',
  'lastname',
  'emailaddress1',
  'jobtitle',
  'department',
  'telephone1',
  'mobilephone',
  'address1_line1',
  'address1_city',
  'address1_postalcode',
  'address1_country',
  'donotbulkemail',
  'createdon',
]

/**
 * Fetch a colleague's contact by id. Colleagues live on the `team` tier (same
 * account), so we read from there — read-only in the portal.
 */
export async function fetchColleague(client: DataverseClient, id: string): Promise<Contact> {
  const res = await client.team.get<Contact>('contact', id, { select: COLLEAGUE_DETAIL_SELECT })
  return res.data
}

/** Recent cases where this colleague is the primary contact (team tier). */
export async function listColleagueCases(
  client: DataverseClient,
  contactId: string,
): Promise<Case[]> {
  const res = await client.team.list<Case>('case', {
    select: CASE_SELECT,
    filter: { field: 'primarycontactid', operator: 'eq', value: contactId },
    orderBy: { field: 'createdon', direction: 'desc' },
    top: 10,
  })
  return res.data
}

/** Columns the portal reads. Keep this list tight — the API only returns what you ask for. */
const CONTACT_SELECT = [
  'contactid',
  'fullname',
  'firstname',
  'lastname',
  'emailaddress1',
  'telephone1',
  'mobilephone',
  'jobtitle',
  'address1_line1',
  'address1_city',
  'address1_postalcode',
  'address1_country',
  'createdon',
  'modifiedon',
]

/**
 * Fetch the signed-in user's own contact record.
 *
 * `client.me` is row-scoped to the caller's contact (via the table's
 * contactJoinPath), so a `me` list on `contact` returns at most that one row —
 * no need to know the id up front. We read the first row back.
 *
 * Returns `null` when the user is authenticated but has no contact yet
 * (see registerMyContact below to self-provision one).
 */
export async function fetchMyContact(client: DataverseClient): Promise<Contact | null> {
  const res = await client.me.list<Contact>('contact', {
    select: CONTACT_SELECT,
    top: 1,
    // Try a filter instead to narrow a wider table, e.g.:
    // filter: { field: 'statecode', operator: 'eq', value: 0 },
  })
  // NB: the SDK returns { data, page } — list rows live on `.data`, not `.value`.
  return res.data[0] ?? null
}

/**
 * Update the signed-in user's own contact.
 *
 * `client.me.update` targets a record the caller owns; the SDK issues the PATCH
 * and returns the updated row on `.data`. Only send changed fields.
 *
 * Next step: after saving you'll usually want to refresh — the useMyContact
 * hook does exactly that.
 */
export async function updateMyContact(
  client: DataverseClient,
  id: string,
  patch: Partial<EditableContactFields>,
): Promise<Contact> {
  const res = await client.me.update<Contact>('contact', id, patch)
  return res.data
}

/**
 * Self-provision a contact for a signed-in user who doesn't have one yet.
 *
 * The email is taken from the verified token (never from the arguments) — only
 * name fields are accepted. Idempotent: returns the existing contact if one
 * already exists. Requires the `rcportal` scope to have self-registration
 * enabled, otherwise the API responds 403.
 */
export async function registerMyContact(
  client: DataverseClient,
  names?: { firstname?: string; lastname?: string },
) {
  return client.me.register(names)
}

/**
 * Who is the caller? Returns identity + their Dataverse contactid/account.
 * Useful for a "you are signed in as…" line, or to detect a missing contact
 * (contactid is empty) before deciding whether to call registerMyContact.
 */
export async function fetchWhoami(client: DataverseClient) {
  return client.me.whoami()
}
