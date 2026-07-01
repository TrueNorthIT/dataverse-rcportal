/**
 * Shape of a customer site as this portal uses it.
 *
 * Sites are modelled on the native Dataverse `customeraddress` table (the
 * "More Addresses" of an account) — `site` (Field Service) is Microsoft-locked
 * and has no account link. Regenerate from the published schema once the
 * `rcportal` scope's `site` route is provisioned:
 *   contact-admin tables get site --scope rcportal --json
 * (route name `site`; Dataverse table `customeraddress`).
 */
export interface Site {
  customeraddressid: string
  /** Site name, e.g. "Leeds Head Office". */
  name?: string
  line1?: string
  city?: string
  postalcode?: string
  /** Choice: 1=Bill To, 2=Ship To, 3=Primary, 4=Other. */
  addresstypecode?: number
  addresstypecode_label?: string
  createdon?: string
}
