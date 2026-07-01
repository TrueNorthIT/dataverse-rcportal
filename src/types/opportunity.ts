/**
 * Shape of a Dataverse `opportunity` record as this portal uses it.
 *
 * PROVISIONAL — standard Dataverse `opportunity` columns. Regenerate from the
 * published schema once the `rcportal` scope is provisioned:
 *   contact-admin tables get opportunity --scope rcportal --json
 *
 * Choice fields (statecode/statuscode) come back with a `<field>_label`
 * companion string from the API — prefer that for display.
 */
export interface Opportunity {
  opportunityid: string
  name?: string
  estimatedvalue?: number
  estimatedclosedate?: string
  statecode?: number
  statecode_label?: string
  statuscode?: number
  statuscode_label?: string
  /** Lookup → contact (primary contact / "me" owner). */
  _parentcontactid_value?: string
  /** Lookup → account (the company). */
  _parentaccountid_value?: string
  createdon?: string
  modifiedon?: string
}
