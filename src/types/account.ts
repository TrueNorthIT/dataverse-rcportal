/**
 * Shape of a Dataverse `account` (company) record as this portal uses it.
 *
 * PROVISIONAL — standard Dataverse `account` columns. Once the `rcportal` scope
 * is provisioned, regenerate from the published schema instead of trusting this:
 *   contact-admin tables get account --scope rcportal --json
 */
export interface Account {
  accountid: string
  name?: string
  telephone1?: string
  websiteurl?: string
  emailaddress1?: string
  address1_line1?: string
  address1_city?: string
  address1_postalcode?: string
  address1_country?: string
  /** Lookup → contact; value + expanded label companion. */
  _primarycontactid_value?: string
  primarycontactid?: { contactid: string; fullname?: string }
  createdon?: string
  modifiedon?: string
}
