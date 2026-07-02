/**
 * Shape of a Dataverse `quote` record as this portal uses it.
 *
 * PROVISIONAL — standard Dataverse `quote` columns. Regenerate from the
 * published schema once the `rcportal` scope is provisioned:
 *   contact-admin tables get quote --scope rcportal --json
 */
export interface Quote {
  quoteid: string
  name?: string
  description?: string
  quotenumber?: string
  totalamount?: number
  statecode?: number
  statecode_label?: string
  statuscode?: number
  statuscode_label?: string
  /** Lookup → opportunity this quote belongs to. */
  _opportunityid_value?: string
  createdon?: string
  modifiedon?: string
}

/** Fields accepted when a customer creates a quote (`client.me.create`). */
export interface NewQuote {
  name: string
  opportunityid?: string
}
